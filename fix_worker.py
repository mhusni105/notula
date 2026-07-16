import re

with open('server.ts', 'r', encoding='utf-8') as f:
    content = f.read()

find_str = '''// Transcribe from local file (don't wait for GDrive upload)
        let transcriptionResult = "";// 2. LLM Summarization Phase'''

replace_str = '''// Transcribe from local file (don't wait for GDrive upload)
        let transcriptionResult = "";

        if (provider) {
          try {
            const providerInfo = provider.getProviderInfo();
            addLog("info", Mengirimkan file audio ke  untuk proses transkripsi teks (STT)...);
            const mimeType = getMimeType(audioFileExt);
            transcriptionResult = await provider.transcribeAudio(localFilePath, mimeType);
            addLog("success", Proses transkripsi STT via  selesai berhasil.);
          } catch (err: any) {
            addLog("error", Gagal memproses STT, String(err));
            // If Anthropic (no STT), fall back to simulation
            if (String(err).includes("Anthropic tidak mendukung")) {
              addLog("warning", "Anthropic tidak mendukung STT. Menggunakan SIMULASI transkripsi.");
              await new Promise((r) => setTimeout(r, 2000));
              transcriptionResult = [SIMULASI TRANSKRIPSI - Anthropic tidak memiliki STT API]
Percakapan ini tidak dapat ditranskripsi karena provider AI yang dipilih (Anthropic/Claude) tidak mendukung transkripsi audio. Silakan ganti ke Gemini atau OpenAI untuk fitur STT.;
            } else {
              throw new Error(API STT Gagal: );
            }
          }
        } else {
          // Simulation mode when no API Key is detected
          addLog("warning", "Menggunakan SIMULASI STT karena tidak ada API Key terdeteksi.");
          await new Promise((r) => setTimeout(r, 4000));
          transcriptionResult = [SIMULASI TRANSKRIPSI]
Halo selamat pagi rekan-rekan sekalian. Terima kasih sudah hadir dalam rapat koordinasi proyek Note-Taker hari ini tanggal 11 Juli 2026.
Hari ini agenda utama kita adalah membahas rilis MVP pertama untuk sistem self-hosted AI Note-Taker kita.
Pertama, untuk backend dan sinkronisasi, Budi sudah berhasil membangun integrasi Google Drive untuk menghemat space lokal, di mana server langsung mendelete salinan audio fisik setelah upload diverifikasi. Bagus sekali Budi.
Kedua, untuk autentikasi dan enkripsi, Ani mengonfirmasi bahwa data teks transkripsi dan rangkuman berhasil dienkripsi di level aplikasi sebelum disimpan ke database menggunakan AES-256-CBC. Ini sangat krusial untuk keamanan data rapat personal kita.
Untuk action items, Budi harap segera selesaikan modul sync offline di mobile, lalu Ani pastikan kunci enkripsi dikelola secara aman dalam env variables. Target kita adalah mendeploy aplikasi ini dalam 2 hari ke depan. Terima kasih semua.;
        }

        // Apply encryption at application level before saving
        const encryptedSTT = encryptText(transcriptionResult);
        addLog("info", "Enkripsi tingkat aplikasi diterapkan pada teks transkripsi.");

        // NFR-02.2: Hapus file fisik lokal SETELAH transkripsi selesai
        if (fs.existsSync(localFilePath)) {
          fs.unlinkSync(localFilePath);
          addLog("success", NFR-02.2 Clean-Up: File lokal dihapus setelah transkripsi, Path: );
        }

        // Wait for Google Drive upload to complete (optional, but good for consistency)
        await gdriveUploadPromise;

        db = readDB();
        db.notes = db.notes.map((n) =>
          n.id === pendingNote.id
            ? {
                ...n,
                status: ProcessStatus.SUMMARIZING,
                transcriptionEncrypted: encryptedSTT,
              }
            : n
        );
        writeDB(db);
        pendingNote.status = ProcessStatus.SUMMARIZING;
      }

      // 2. LLM Summarization Phase'''

if find_str in content:
    content = content.replace(find_str, replace_str)
    print('REPLACED!')
else:
    print('NOT FOUND')
    idx = content.find('let transcriptionResult = ')
    if idx >= 0:
        print(f'Found at {idx}')
        print(repr(content[idx:idx+100]))
    else:
        print('Substring not found either')

with open('server.ts', 'w', encoding='utf-8') as f:
    f.write(content)
