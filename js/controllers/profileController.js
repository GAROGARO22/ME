export async function initProfileController({ app }) {
  const form = document.getElementById('profileForm');
  const nameInput = document.getElementById('profileName');
  const phoneInput = document.getElementById('profilePhone');
  const storeInput = document.getElementById('profileStore');
  const emailInput = document.getElementById('profileEmail');

  if (!form || !app.currentUser?.uid) return;

  const userDoc = await app.db.collection('users').doc(app.currentUser.uid).get();
  const data = userDoc.data() || {};
  nameInput.value = data.name || app.currentUser.displayName || '';
  phoneInput.value = data.phone || '';
  storeInput.value = data.store || '';
  emailInput.value = data.email || app.currentUser.email || '';

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const updatedData = {
      name: nameInput.value,
      phone: phoneInput.value,
      store: storeInput.value,
      email: emailInput.value
    };

    try {
      await app.db.collection('users').doc(app.currentUser.uid).update(updatedData);
      await app.currentUser.updateProfile({ displayName: nameInput.value });
      app.showNotification('تم حفظ الملف الشخصي بنجاح', 'success');
    } catch (error) {
      console.error(error);
      app.showNotification('حدث خطأ أثناء حفظ الملف الشخصي', 'error');
    }
  });
}
