/**
 * Cloud Functions for Meraj SaaS - Gmail Integration
 * Handles OAuth token exchange, email fetching, and order parsing
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const simpleParser = require("simple-parser");

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Gmail API Configuration
const OAUTH2_CLIENT_ID = functions.config().gmail?.client_id || process.env.GMAIL_CLIENT_ID;
const OAUTH2_CLIENT_SECRET = functions.config().gmail?.client_secret || process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = functions.config().gmail?.redirect_uri || process.env.GMAIL_REDIRECT_URI;

// Create OAuth2 Client
const oauth2Client = new google.auth.OAuth2(
  OAUTH2_CLIENT_ID,
  OAUTH2_CLIENT_SECRET,
  REDIRECT_URI
);

/**
 * Exchange authorization code for access and refresh tokens
 * Called after user grants permission on Google OAuth consent screen
 */
exports.exchangeToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  const { code } = data;
  if (!code) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Authorization code is required"
    );
  }

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    // Set credentials for the OAuth2 client
    oauth2Client.setCredentials(tokens);

    // Save tokens to Firestore securely
    const userId = context.auth.uid;
    await db.collection("users").doc(userId).set({
      gmailTokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
        scope: tokens.scope,
        tokenType: tokens.token_type,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      gmailConnected: true,
      lastSyncAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Get user profile info
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    
    return {
      success: true,
      message: "تم ربط حساب جيميل بنجاح",
      email: userInfo.data.email,
      name: userInfo.data.name
    };
  } catch (error) {
    console.error("Token exchange error:", error);
    throw new functions.https.HttpsError(
      "internal",
      "فشل في ربط حساب جيميل: " + error.message
    );
  }
});

/**
 * Refresh Gmail access token using refresh token
 */
async function refreshAccessToken(userId) {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      throw new Error("User not found");
    }

    const userData = userDoc.data();
    if (!userData.gmailTokens || !userData.gmailTokens.refreshToken) {
      throw new Error("No refresh token available");
    }

    oauth2Client.setCredentials({
      refresh_token: userData.gmailTokens.refreshToken
    });

    const { tokens } = await oauth2Client.refreshAccessToken();
    
    // Update tokens in Firestore
    await db.collection("users").doc(userId).update({
      "gmailTokens.accessToken": tokens.access_token,
      "gmailTokens.expiryDate": tokens.expiry_date,
      "gmailTokens.updatedAt": admin.firestore.FieldValue.serverTimestamp()
    });

    oauth2Client.setCredentials(tokens);
    return oauth2Client;
  } catch (error) {
    console.error("Token refresh error:", error);
    throw error;
  }
}

/**
 * Fetch emails from Gmail and extract orders
 * Callable function triggered by user action
 */
exports.fetchGmailOrders = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  const userId = context.auth.uid;
  const maxResults = data.maxResults || 50;
  const labelIds = data.labelIds || ["INBOX"];

  try {
    // Get or refresh OAuth client
    let authClient;
    try {
      authClient = await refreshAccessToken(userId);
    } catch (error) {
      // If refresh fails, disconnect Gmail
      await db.collection("users").doc(userId).update({
        gmailConnected: false,
        gmailTokens: admin.firestore.FieldValue.delete(),
        lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
        syncError: error.message
      });
      throw new functions.https.HttpsError(
        "failed-precondition",
        "انتهت صلاحية اتصال جيميل، يرجى إعادة الربط"
      );
    }

    // Initialize Gmail API
    const gmail = google.gmail({ version: "v1", auth: authClient });

    // List messages - Enhanced query to include all SHEIN email types
    const response = await gmail.users.messages.list({
      userId: "me",
      maxResults: maxResults,
      labelIds: labelIds,
      q: "subject:(طلب جديد|order confirmation|شكرًا لطلبك|تم استلام طلبك|تأكيد الدفع|payment confirmation|تم شحن|shipped|تم التسليم|delivered|استرداد|refund)"
    });

    if (!response.data.messages || response.data.messages.length === 0) {
      return {
        success: true,
        message: "لا توجد طلبات جديدة في البريد",
        orders: [],
        count: 0
      };
    }

    const orders = [];
    const processedIds = new Set();

    // Process each message
    for (const message of response.data.messages) {
      try {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id: message.id,
          format: "full"
        });

        const messageId = msg.data.id;
        
        // Skip if already processed in this session
        if (processedIds.has(messageId)) continue;

        // Parse email content
        const emailData = parseEmailContent(msg.data);
        
        // Extract order information
        const orderInfo = extractOrderFromEmail(emailData);
        
        if (orderInfo) {
          // Check if order already exists by order number to prevent duplicates
          let existingOrder;
          if (orderInfo.orderNumber) {
            existingOrder = await db.collection("orders")
              .where("userId", "==", userId)
              .where("orderNumber", "==", orderInfo.orderNumber)
              .limit(1)
              .get();
          }

          if (!existingOrder || existingOrder.empty) {
            // Create new order
            orderInfo.gmailMessageId = messageId;
            orderInfo.userId = userId;
            orderInfo.source = "gmail";
            orderInfo.createdAt = admin.firestore.FieldValue.serverTimestamp();
            orderInfo.rawEmail = {
              from: emailData.from,
              to: emailData.to,
              subject: emailData.subject,
              date: emailData.date,
              headers: msg.data.payload.headers
            };

            const orderRef = await db.collection("orders").add(orderInfo);
            
            orders.push({
              id: orderRef.id,
              ...orderInfo,
              _isNew: true
            });
          } else {
            // Update existing order with new information (lifecycle management)
            const existingDoc = existingOrder.docs[0];
            const existingData = existingDoc.data();
            
            // Prepare update data - merge new info with existing
            const fieldsToUpdate = {};
            if (orderInfo.trackingNumber) fieldsToUpdate.trackingNumber = orderInfo.trackingNumber;
            if (orderInfo.courier) fieldsToUpdate.courier = orderInfo.courier;
            if (orderInfo.estimatedDeliveryDate) fieldsToUpdate.estimatedDeliveryDate = orderInfo.estimatedDeliveryDate;
            if (orderInfo.refundAmount > 0) fieldsToUpdate.refundAmount = orderInfo.refundAmount;
            if (orderInfo.orderStatus) fieldsToUpdate.orderStatus = orderInfo.orderStatus;
            if (orderInfo.lastEmailTypeSynced) fieldsToUpdate.lastEmailTypeSynced = orderInfo.lastEmailTypeSynced;
            if (orderInfo.status) fieldsToUpdate.status = orderInfo.status;
            if (orderInfo.shippingAddress) fieldsToUpdate.shippingAddress = orderInfo.shippingAddress;
            
            fieldsToUpdate.updatedAt = admin.firestore.FieldValue.serverTimestamp();
            fieldsToUpdate.gmailMessageId = messageId;
            fieldsToUpdate.rawEmail = {
              from: emailData.from,
              to: emailData.to,
              subject: emailData.subject,
              date: emailData.date,
              headers: msg.data.payload.headers
            };

            await db.collection("orders").doc(existingDoc.id).update(fieldsToUpdate);
            
            orders.push({
              id: existingDoc.id,
              ...existingData,
              ...fieldsToUpdate,
              _isNew: false
            });
          }

          processedIds.add(messageId);
        }
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        continue;
      }
    }

    // Update last sync time
    await db.collection("users").doc(userId).update({
      lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
      totalOrdersSynced: admin.firestore.FieldValue.increment(orders.length)
    });

    return {
      success: true,
      message: `تم جلب ${orders.length} طلب جديد`,
      orders: orders,
      count: orders.length
    };
  } catch (error) {
    console.error("Fetch Gmail orders error:", error);
    throw new functions.https.HttpsError(
      "internal",
      "فشل في جلب الطلبات من جيميل: " + error.message
    );
  }
});

/**
 * Parse email content from Gmail API response
 */
function parseEmailContent(messageData) {
  const headers = {};
  const payload = messageData.payload;
  
  // Extract headers
  if (payload.headers) {
    payload.headers.forEach(header => {
      headers[header.name.toLowerCase()] = header.value;
    });
  }

  // Extract body
  let body = "";
  let htmlBody = "";
  
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body.data) {
        body = Buffer.from(part.body.data, "base64").toString("utf-8");
      } else if (part.mimeType === "text/html" && part.body.data) {
        htmlBody = Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }
  } else if (payload.body.data) {
    if (payload.mimeType === "text/plain") {
      body = Buffer.from(payload.body.data, "base64").toString("utf-8");
    } else if (payload.mimeType === "text/html") {
      htmlBody = Buffer.from(payload.body.data, "base64").toString("utf-8");
    }
  }

  return {
    from: headers.from || "",
    to: headers.to || "",
    subject: headers.subject || "",
    date: headers.date || "",
    messageId: headers["message-id"] || "",
    body: body,
    htmlBody: htmlBody,
    headers: headers
  };
}

/**
 * Classify SHEIN email type based on subject line
 * @param {string} subject - Email subject line
 * @returns {string} - Email type classification
 */
function classifySheinEmail(subject) {
  if (!subject) return 'UNKNOWN';
  
  const lowerSubject = subject.toLowerCase();
  
  // Payment Confirmation
  if (lowerSubject.includes('تأكيد الدفع') || 
      lowerSubject.includes('payment confirmation') ||
      lowerSubject.includes('تم تأكيد طلبك') ||
      lowerSubject.includes('order confirmed')) {
    return 'PAYMENT_CONFIRMATION';
  }
  
  // Order Shipped
  if (lowerSubject.includes('تم شحن طلبك') || 
      lowerSubject.includes('shipped') ||
      lowerSubject.includes('طلبك في الطريق') ||
      lowerSubject.includes('on the way')) {
    return 'ORDER_SHIPPED';
  }
  
  // Order Delivered
  if (lowerSubject.includes('إشعار بتسليم الطلب') || 
      lowerSubject.includes('delivered') ||
      lowerSubject.includes('تم التسليم') ||
      lowerSubject.includes('تم استلام طلبك')) {
    return 'ORDER_DELIVERED';
  }
  
  // Refund Confirmation
  if (lowerSubject.includes('قبول طلب سحب المبلغ') || 
      lowerSubject.includes('refund') ||
      lowerSubject.includes('استرداد المبلغ') ||
      lowerSubject.includes('return approved')) {
    return 'ORDER_REFUNDED';
  }
  
  return 'UNKNOWN';
}

/**
 * Extract order information from email content
 * Uses regex patterns to identify common order fields
 */
function extractOrderFromEmail(emailData) {
  const { subject, body, htmlBody } = emailData;
  const content = body || htmlBody || "";
  
  // Classify the email type first
  const emailType = classifySheinEmail(subject);
  
  const orderInfo = {
    customerName: null,
    customerEmail: null,
    customerPhone: null,
    items: [],
    totalAmount: null,
    currency: "SAR",
    orderNumber: null,
    shippingAddress: null,
    notes: null,
    status: "pending",
    // New fields for SHEIN integration
    trackingNumber: '',
    courier: '',
    estimatedDeliveryDate: '',
    refundAmount: 0,
    orderStatus: 'paid',
    lastEmailTypeSynced: emailType === 'UNKNOWN' ? null : emailType.toLowerCase()
  };

  // Extract order number - enhanced patterns for SHEIN
  const orderNumberPatterns = [
    /رقم الطلب[:\s]+([A-Z0-9\-]+)/i,
    /order\s*(?:number|#)?[:\s]*([A-Z0-9\-]+)/i,
    /طلب\s*رقم[:\s]+([A-Z0-9\-]+)/i,
    /Order\s*#?\s*([A-Z0-9\-]+)/i,
    /SH(?:E)?IN\s*[:\s]*([A-Z0-9\-]+)/i
  ];
  
  for (const pattern of orderNumberPatterns) {
    const match = content.match(pattern);
    if (match) {
      orderInfo.orderNumber = match[1].trim();
      break;
    }
  }

  // Extract customer name - including Arabic greeting format
  const namePatterns = [
    /الاسم[:\s]+([أ-يA-Za-z\s]+)/i,
    /customer\s*name[:\s]+([أ-يA-Za-z\s]+)/i,
    /عزيزي\s+([أ-يA-Za-z\s]+)/i,
    /مرحبا\s+([أ-يA-Za-z\s]+)/i,
    /hello\s+([أ-يA-Za-z\s]+)/i,
    /dear\s+([أ-يA-Za-z\s]+)/i
  ];
  
  for (const pattern of namePatterns) {
    const match = content.match(pattern);
    if (match) {
      orderInfo.customerName = match[1].trim();
      break;
    }
  }

  // Extract email
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const emailMatch = content.match(emailPattern);
  if (emailMatch) {
    orderInfo.customerEmail = emailMatch[0];
  }

  // Extract phone number (Saudi format)
  const phonePatterns = [
    /الجوال[:\s]+(05\d{8})/i,
    /الهاتف[:\s]+(05\d{8})/i,
    /phone[:\s]+(\+?9665\d{8}|05\d{8})/i,
    /mobile[:\s]+(\+?9665\d{8}|05\d{8})/i
  ];
  
  for (const pattern of phonePatterns) {
    const match = content.match(pattern);
    if (match) {
      orderInfo.customerPhone = match[1];
      break;
    }
  }

  // Extract total amount - supporting SR108.19 format and other formats
  const amountPatterns = [
    /SR([0-9,]+\.?[0-9]*)/i,
    /الإجمالي[:\s]+([0-9,]+\.?[0-9]*)\s*(ريال|SAR|USD)/i,
    /total[:\s]+([0-9,]+\.?[0-9]*)\s*(ريال|SAR|USD)/i,
    /المبلغ[:\s]+([0-9,]+\.?[0-9]*)\s*(ريال|SAR|USD)/i,
    /amount[:\s]+([0-9,]+\.?[0-9]*)\s*(ريال|SAR|USD)/i,
    /([0-9,]+\.?[0-9]*)\s*(ريال|SAR)/i
  ];
  
  for (const pattern of amountPatterns) {
    const match = content.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(amount)) {
        orderInfo.totalAmount = amount;
        if (match[2]) {
          orderInfo.currency = match[2].toUpperCase() === "ريال" ? "SAR" : match[2];
        }
        break;
      }
    }
  }

  // Extract shipping address
  const addressPatterns = [
    /العنوان[:\s]+([^\n]+)/i,
    /shipping\s*address[:\s]+([^\n]+)/i,
    /address[:\s]+([^\n]+)/i,
    /Ship to[:\s]+([^\n]+)/i,
    /الشحن إلى[:\s]+([^\n]+)/i
  ];
  
  for (const pattern of addressPatterns) {
    const match = content.match(pattern);
    if (match) {
      orderInfo.shippingAddress = match[1].trim();
      break;
    }
  }

  // Extract tracking number (JDW... format for JD courier)
  const trackingPatterns = [
    /رقم التتبع[:\s]*([A-Z]{2,}\d+)/i,
    /tracking\s*(?:number|#)?[:\s]*([A-Z]{2,}\d+)/i,
    /JDW[A-Z0-9]+/i,
    /tracking[:\s]*([A-Z0-9]+)/i
  ];
  
  for (const pattern of trackingPatterns) {
    const match = content.match(pattern);
    if (match) {
      orderInfo.trackingNumber = match[0].trim();
      // Auto-detect courier based on tracking number format
      if (match[0].startsWith('JDW') || match[0].includes('JD')) {
        orderInfo.courier = 'JD';
      }
      break;
    }
  }

  // Extract courier company
  const courierPatterns = [
    /شركة التوصيل[:\s]+([^\n]+)/i,
    /courier[:\s]+([^\n]+)/i,
    /carrier[:\s]+([^\n]+)/i,
    /via\s+([A-Z]+)/i
  ];
  
  for (const pattern of courierPatterns) {
    const match = content.match(pattern);
    if (match) {
      const courierMatch = match[1].match(/[A-Za-z]+/);
      if (courierMatch) {
        orderInfo.courier = courierMatch[0].trim();
        break;
      }
    }
  }

  // Extract estimated delivery date
  const deliveryDatePatterns = [
    /تاريخ التوصيل المتوقع[:\s]+([^\n]+)/i,
    /estimated\s*delivery[:\s]+([^\n]+)/i,
    /expected\s*delivery[:\s]+([^\n]+)/i,
    /by\s+(\d{1,2}\s+\w+\s+\d{4})/i,
    /في\s+(\d{1,2}\s+\w+\s+\d{4})/i
  ];
  
  for (const pattern of deliveryDatePatterns) {
    const match = content.match(pattern);
    if (match) {
      orderInfo.estimatedDeliveryDate = match[1].trim();
      break;
    }
  }

  // Extract refund amount
  const refundPatterns = [
    /قيمة المبلغ المسترد[:\s]+([0-9,]+\.?[0-9]*)/i,
    /refund\s*amount[:\s]+([0-9,]+\.?[0-9]*)/i,
    /استرداد[:\s]+([0-9,]+\.?[0-9]*)\s*(ريال|SAR)/i,
    /refunded[:\s]+([0-9,]+\.?[0-9]*)/i
  ];
  
  for (const pattern of refundPatterns) {
    const match = content.match(pattern);
    if (match) {
      const refundAmount = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(refundAmount)) {
        orderInfo.refundAmount = refundAmount;
        break;
      }
    }
  }

  // Set order status based on email type
  switch (emailType) {
    case 'PAYMENT_CONFIRMATION':
      orderInfo.orderStatus = 'paid';
      orderInfo.status = 'pending';
      break;
    case 'ORDER_SHIPPED':
      orderInfo.orderStatus = 'shipped';
      orderInfo.status = 'processing';
      break;
    case 'ORDER_DELIVERED':
      orderInfo.orderStatus = 'delivered';
      orderInfo.status = 'completed';
      break;
    case 'ORDER_REFUNDED':
      orderInfo.orderStatus = 'refunded';
      orderInfo.status = 'cancelled';
      break;
    default:
      orderInfo.orderStatus = 'paid';
      orderInfo.status = 'pending';
  }

  // Simple item extraction (can be enhanced based on specific email formats)
  const itemPatterns = [
    /المنتج[:\s]+([^\n]+)/gi,
    /item[:\s]+([^\n]+)/gi,
    /quantity[:\s]+([0-9]+)/gi
  ];

  // Try to detect if this is an order email based on keywords
  const orderKeywords = [
    "طلب جديد", "order confirmation", "شكرًا لطلبك", 
    "تم استلام طلبك", "new order", "order received",
    "تأكيد الدفع", "payment confirmation",
    "تم شحن", "shipped",
    "تم التسليم", "delivered",
    "استرداد", "refund"
  ];
  
  const isOrderEmail = orderKeywords.some(keyword => 
    subject.toLowerCase().includes(keyword.toLowerCase()) ||
    content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (!isOrderEmail) {
    return null;
  }

  // Only return if we found at least some order information
  if (orderInfo.orderNumber || orderInfo.customerName || orderInfo.totalAmount || orderInfo.trackingNumber) {
    return orderInfo;
  }

  return null;
}

/**
 * Scheduled function to auto-sync emails every hour
 */
exports.scheduledEmailSync = functions.pubsub
  .schedule("every 60 minutes")
  .onRun(async (context) => {
    try {
      // Get all users with Gmail connected
      const snapshot = await db.collection("users")
        .where("gmailConnected", "==", true)
        .get();

      if (snapshot.empty) {
        console.log("No users with Gmail connected");
        return;
      }

      const syncPromises = [];
      
      for (const doc of snapshot.docs) {
        const userId = doc.id;
        
        // Create a callable-like context
        const fakeContext = { auth: { uid: userId } };
        
        // Call the fetch function
        syncPromises.push(
          fetchGmailOrdersForUser(userId)
            .then(result => {
              console.log(`Synced user ${userId}: ${result.count} orders`);
            })
            .catch(error => {
              console.error(`Failed to sync user ${userId}:`, error);
            })
        );
      }

      await Promise.all(syncPromises);
      console.log("Scheduled sync completed");
    } catch (error) {
      console.error("Scheduled sync error:", error);
    }
  });

/**
 * Helper function to fetch orders for a specific user
 */
async function fetchGmailOrdersForUser(userId) {
  try {
    let authClient;
    try {
      authClient = await refreshAccessToken(userId);
    } catch (error) {
      await db.collection("users").doc(userId).update({
        gmailConnected: false,
        syncError: error.message
      });
      return { success: false, count: 0, error: error.message };
    }

    const gmail = google.gmail({ version: "v1", auth: authClient });

    const response = await gmail.users.messages.list({
      userId: "me",
      maxResults: 50,
      labelIds: ["INBOX"],
      q: "subject:(طلب جديد|order confirmation|شكرًا لطلبك|تم استلام طلبك|تأكيد الدفع|payment confirmation|تم شحن|shipped|تم التسليم|delivered|استرداد|refund)"
    });

    if (!response.data.messages || response.data.messages.length === 0) {
      return { success: true, count: 0, orders: [] };
    }

    let orderCount = 0;

    for (const message of response.data.messages) {
      try {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id: message.id,
          format: "full"
        });

        const messageId = msg.data.id;
        
        // Parse email content
        const emailData = parseEmailContent(msg.data);
        const orderInfo = extractOrderFromEmail(emailData);
        
        if (orderInfo) {
          // Check if order already exists by order number to prevent duplicates
          let existingOrder;
          if (orderInfo.orderNumber) {
            existingOrder = await db.collection("orders")
              .where("userId", "==", userId)
              .where("orderNumber", "==", orderInfo.orderNumber)
              .limit(1)
              .get();
          }

          if (!existingOrder || existingOrder.empty) {
            // Create new order
            orderInfo.gmailMessageId = messageId;
            orderInfo.userId = userId;
            orderInfo.source = "gmail";
            orderInfo.createdAt = admin.firestore.FieldValue.serverTimestamp();
            
            await db.collection("orders").add(orderInfo);
            orderCount++;
          } else {
            // Update existing order with new information (lifecycle management)
            const existingDoc = existingOrder.docs[0];
            
            const fieldsToUpdate = {};
            if (orderInfo.trackingNumber) fieldsToUpdate.trackingNumber = orderInfo.trackingNumber;
            if (orderInfo.courier) fieldsToUpdate.courier = orderInfo.courier;
            if (orderInfo.estimatedDeliveryDate) fieldsToUpdate.estimatedDeliveryDate = orderInfo.estimatedDeliveryDate;
            if (orderInfo.refundAmount > 0) fieldsToUpdate.refundAmount = orderInfo.refundAmount;
            if (orderInfo.orderStatus) fieldsToUpdate.orderStatus = orderInfo.orderStatus;
            if (orderInfo.lastEmailTypeSynced) fieldsToUpdate.lastEmailTypeSynced = orderInfo.lastEmailTypeSynced;
            if (orderInfo.status) fieldsToUpdate.status = orderInfo.status;
            if (orderInfo.shippingAddress) fieldsToUpdate.shippingAddress = orderInfo.shippingAddress;
            
            fieldsToUpdate.updatedAt = admin.firestore.FieldValue.serverTimestamp();
            fieldsToUpdate.gmailMessageId = messageId;

            await db.collection("orders").doc(existingDoc.id).update(fieldsToUpdate);
            orderCount++;
          }
        }
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        continue;
      }
    }

    await db.collection("users").doc(userId).update({
      lastSyncAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, count: orderCount };
  } catch (error) {
    console.error("Fetch orders error:", error);
    throw error;
  }
}

/**
 * Disconnect Gmail account
 */
exports.disconnectGmail = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  const userId = context.auth.uid;

  try {
    await db.collection("users").doc(userId).update({
      gmailConnected: false,
      gmailTokens: admin.firestore.FieldValue.delete(),
      lastSyncAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      message: "تم فصل حساب جيميل بنجاح"
    };
  } catch (error) {
    console.error("Disconnect Gmail error:", error);
    throw new functions.https.HttpsError(
      "internal",
      "فشل في فصل حساب جيميل: " + error.message
    );
  }
});
