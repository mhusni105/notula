with open('server.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old = '''FR-02.3: Audio disimpan sementara di lokal server (atau simulasi physical stream) sebelum diupload ke Drive
    const audioBuffer = Buffer.from(audioBase64, "base64");
    fs.writeFileSync(localFilePath, audioBuffer);
    addLog("info", \File audio tersimpan fisik di server lokal sementara\, \Path: ./uploads/\ (\ MB)\);

    // Check if user has real Google Drive connected
    db = readDB();
    const gCurrentUser = db.users.find((u) => u.id === userId);
    const hasRealGDrive = !!(gCurrentUser?.googleTokens?.access_token);
    
    let gdriveFileId = "";
    let gdriveStorageType = "simulated";
    
    if (hasRealGDrive && googleOAuth2Client) {
      // Real Google Drive upload
      addLog("info", "Mengunggah ke Google Drive sungguhan untuk user " + (gCurrentUser!.googleEmail || userId) + "...");
      const mimeType = getMimeType(audioExt);
      const result = await uploadToGoogleDrive(userId, localFileName, audioBuffer, mimeType);
      
      if (result.fileId) {
        gdriveFileId = result.fileId;
        gdriveStorageType = "real";
        addLog("success", "Unggah ke Google Drive sungguhan berhasil!", "File ID: " + gdriveFileId);
      } else {
        addLog("warning", "Gagal unggah ke Google Drive sungguhan, fallback ke simulasi", result.error);
        // Fallback to simulated
        gdriveFileId = "gdrive_" + noteId;
        const driveFilePath = path.join(GDRIVE_SIM_DIR, gdriveFileId + "." + audioExt);
        fs.writeFileSync(driveFilePath, audioBuffer);
        addLog("success", "Unggah fallback ke simulasi Google Drive berhasil.", "File ID: " + gdriveFileId);
      }
    } else {
      // Simulated Google Drive upload (original behavior)
      gdriveFileId = "gdrive_" + noteId;
      const driveFilePath = path.join(GDRIVE_SIM_DIR, gdriveFileId + "." + audioExt);

      addLog("info", "Mulai streaming data dari server lokal ke Google Drive Cloud Storage (SIMULASI)...");
      fs.writeFileSync(driveFilePath, audioBuffer);
      addLog("success", "Unggah berhasil! File terverifikasi di Google Drive Cloud Storage (SIMULASI).", "File ID: " + gdriveFileId);
    }// NFR-02.2: Segera hapus file fisik lokal di server backend setelah verifikasi
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
      addLog("success", \NFR-02.2 Clean-Up: Salinan fisik lokal di server backend telah BERHASIL DIHAPUS.\);
    
'''

new = '''FR-02.3: Audio disimpan di lokal server untuk transkripsi cepat
    // File akan dihapus SETELAH transkripsi selesai (bukan setelah upload GDrive)
    const audioBuffer = Buffer.from(audioBase64, "base64");
    fs.writeFileSync(localFilePath, audioBuffer);
    addLog("info", \File audio tersimpan fisik di server lokal\, \Path: ./uploads/\ (\ MB)\);

    // Google Drive upload akan dilakukan di BACKGROUND oleh worker SETELAH transkripsi
    // Di sini kita hanya simpan metadata
    let gdriveFileId = "";
    let gdriveStorageType = "simulated";
    
    // Check if user has real Google Drive connected (untuk metadata)
    db = readDB();
    const gCurrentUser = db.users.find((u) => u.id === userId);
    const hasRealGDrive = !!(gCurrentUser?.googleTokens?.access_token);
    
    if (hasRealGDrive && googleOAuth2Client) {
      gdriveStorageType = "real";
      # gdriveFileId akan diisi oleh worker setelah upload selesai
    } else {
      # Simulated: generate ID sekarang, worker akan buat file nanti
      gdriveFileId = "gdrive_" + noteId;
    }
'''

if old in content:
    content = content.replace(old, new)
    print('FOUND and replaced!')
else:
    print('NOT FOUND - checking...')
    idx = content.find('FR-02.3: Audio disimpan sementara')
    if idx >= 0:
        print(f'Found at {idx}')
        print(repr(content[idx:idx+200]))
    else:
        print('Substring not found either')

with open('server.ts', 'w', encoding='utf-8') as f:
    f.write(content)
