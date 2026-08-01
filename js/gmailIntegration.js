/**
 * Gmail Integration Module for Frontend
 * Handles OAuth flow, token exchange, and order syncing
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { auth, db } from "./firebase.js";
import { doc, updateDoc, getDoc } from "firebase/firestore";

class GmailIntegration {
  constructor() {
    this.functions = getFunctions();
    this.CLIENT_ID = "669970676844-q2tnngthukfnecnovr25vcpd172ov7vk.apps.googleusercontent.com"; // Replace with your actual Client ID
    this.REDIRECT_URI = window.location.origin + "https://me-mu-azure.vercel.app/gmail-callback.html";
    this.SCOPES = [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
      "email",
      "profile"
    ].join(" ");
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl() {
    const params = new URLSearchParams({
      client_id: this.CLIENT_ID,
      redirect_uri: this.REDIRECT_URI,
      response_type: "code",
      scope: this.SCOPES,
      access_type: "offline",
      prompt: "consent"
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Start OAuth flow by redirecting user to Google
   */
  startOAuthFlow() {
    const authUrl = this.getAuthorizationUrl();
    window.location.href = authUrl;
  }

  /**
   * Exchange authorization code for tokens
   * Called from callback page
   */
  async exchangeCode(code) {
    try {
      const exchangeTokenFn = httpsCallable(this.functions, "exchangeToken");
      const result = await exchangeTokenFn({ code });
      
      return {
        success: true,
        data: result.data
      };
    } catch (error) {
      console.error("Token exchange error:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Fetch orders from Gmail
   */
  async fetchOrders(maxResults = 50) {
    try {
      const fetchGmailOrdersFn = httpsCallable(this.functions, "fetchGmailOrders");
      const result = await fetchGmailOrdersFn({ maxResults });
      
      return {
        success: true,
        data: result.data
      };
    } catch (error) {
      console.error("Fetch orders error:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Disconnect Gmail account
   */
  async disconnect() {
    try {
      const disconnectGmailFn = httpsCallable(this.functions, "disconnectGmail");
      const result = await disconnectGmailFn();
      
      return {
        success: true,
        data: result.data
      };
    } catch (error) {
      console.error("Disconnect error:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if Gmail is connected for current user
   */
  async isConnected() {
    try {
      const user = auth.currentUser;
      if (!user) return false;

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists) return false;

      const userData = userDoc.data();
      return userData.gmailConnected === true;
    } catch (error) {
      console.error("Check connection error:", error);
      return false;
    }
  }

  /**
   * Get last sync time
   */
  async getLastSyncTime() {
    try {
      const user = auth.currentUser;
      if (!user) return null;

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists) return null;

      const userData = userDoc.data();
      return userData.lastSyncAt || null;
    } catch (error) {
      console.error("Get last sync error:", error);
      return null;
    }
  }

  /**
   * Format date for display
   */
  formatDate(timestamp) {
    if (!timestamp) return "غير متوفر";
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat("ar-SA", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }
}

// Export singleton instance
export const gmailIntegration = new GmailIntegration();
export default gmailIntegration;
