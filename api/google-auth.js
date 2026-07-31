import { google } from 'googleapis';

/**
 * API للمصادقة مع Google OAuth
 * يستخدم للمزامنة التلقائية مع Gmail و Google Calendar
 */

export default function handler(req, res) {
  // تعيين CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // تعريف مفاتيح جوجل التي حصلنا عليها
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://me-mu-azure.vercel.app';

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    // معالجة طلب المصادقة
    if (req.method === 'GET') {
      const { action } = req.query;

      if (action === 'auth') {
        // إعداد رابط شاشة الموافقة
        const authUrl = oauth2Client.generateAuthUrl({
          access_type: 'offline', // ضروري لجلب الرمز الدائم
          prompt: 'consent',
          scope: [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/calendar'
          ],
        });

        return res.redirect(authUrl);
      }

      if (action === 'callback') {
        const { code } = req.query;

        if (!code) {
          return res.status(400).json({ error: 'Missing authorization code' });
        }

        // تبادل الرمز للحصول على Tokens
        oauth2Client.getToken(code, (err, token) => {
          if (err) {
            console.error('Error retrieving access token:', err);
            return res.status(500).json({ error: 'Failed to retrieve access token' });
          }

          // تخزين الرموز بشكل آمن (في قاعدة البيانات أو الجلسة)
          // هنا نعيدها للعميل ليقوم بتخزينها
          return res.json({
            success: true,
            tokens: {
              accessToken: token.access_token,
              refreshToken: token.refresh_token,
              expiryDate: token.expiry_date
            }
          });
        });

        return;
      }
    }

    // إذا لم يتم التعرف على الطلب
    return res.status(404).json({ error: 'Not found' });

  } catch (error) {
    console.error('Google Auth API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
