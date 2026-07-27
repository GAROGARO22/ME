import { google } from 'googleapis';

export default function handler(req, res) {
  // تعريف مفاتيح جوجل التي حصلنا عليها
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://me-mu-azure.vercel.app';

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    // تأكد من أن هذا الرابط هو نفسه الذي وضعته في إعدادات Google Cloud
    redirectUri
  );

  // إعداد رابط شاشة الموافقة
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // ضروري لجلب الرمز الدائم
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/gmail.readonly'
    ],
  });

  // توجيه العميل
  res.redirect(authUrl);
}
