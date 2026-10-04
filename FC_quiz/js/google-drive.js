window.FCGoogleDrive = (() => {
  const CLIENT_ID = window.FCGoogleDriveConfig.clientId.trim();
  const API_KEY = window.FCGoogleDriveConfig.apiKey.trim();
  const APP_ID = window.FCGoogleDriveConfig.appId.trim();
  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
  const FOLDER_NAME = "FC_quiz";
  const FOLDER_STORAGE_KEY = "fc-quiz-google-drive-folder-id";
  const FILE_NAME = "ai-flashcards.json";
  const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
  const FILE_MIME_TYPE = "application/json";
  const API_URL = "https://www.googleapis.com/drive/v3";
  const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3";

  let accessToken = null;
  let tokenClient = null;
  let identityScriptPromise = null;
  let pickerScriptPromise = null;
  let folderId = window.localStorage.getItem(FOLDER_STORAGE_KEY);

  function loadIdentityServices() {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    if (identityScriptPromise) return identityScriptPromise;

    identityScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = () => {
        if (window.google?.accounts?.oauth2) resolve();
        else reject(new Error("Google 로그인을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요."));
      };
      script.onerror = () => reject(new Error("Google 로그인 서비스에 연결할 수 없습니다."));
      document.head.append(script);
    });

    return identityScriptPromise;
  }

  async function connect() {
    if (!CLIENT_ID) {
      throw new Error(
        "Google OAuth Client ID가 설정되지 않았습니다. README의 Google Drive 설정을 완료해 주세요.",
      );
    }

    await loadIdentityServices();
    if (!folderId && !API_KEY) {
      throw new Error(
        "Google Drive 폴더 선택용 API Key가 설정되지 않았습니다. README의 Google Drive 설정을 완료해 주세요.",
      );
    }
    tokenClient ??= window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: () => {},
    });

    accessToken = await new Promise((resolve, reject) => {
      tokenClient.callback = (response) => {
        if (response.error) {
          reject(new Error(`Google Drive 인증에 실패했습니다: ${response.error}`));
          return;
        }
        if (!response.access_token) {
          reject(new Error("Google Drive 인증 토큰을 받지 못했습니다."));
          return;
        }
        resolve(response.access_token);
      };
      tokenClient.requestAccessToken({ prompt: "" });
    });

    if (!folderId) {
      folderId = await chooseFolder();
      if (!folderId) {
        accessToken = null;
        return false;
      }
      window.localStorage.setItem(FOLDER_STORAGE_KEY, folderId);
    }

    return true;
  }

  function loadPicker() {
    if (window.google?.picker) return Promise.resolve();
    if (pickerScriptPromise) return pickerScriptPromise;

    pickerScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://apis.google.com/js/api.js";
      script.async = true;
      script.onload = () => {
        window.gapi.load("picker", {
          callback: () => resolve(),
          onerror: () => reject(new Error("Google Drive 폴더 선택기를 불러오지 못했습니다.")),
          timeout: 10000,
          ontimeout: () => reject(new Error("Google Drive 폴더 선택기 연결 시간이 초과되었습니다.")),
        });
      };
      script.onerror = () => reject(new Error("Google Drive 폴더 선택기에 연결할 수 없습니다."));
      document.head.append(script);
    });

    return pickerScriptPromise;
  }

  async function chooseFolder() {
    await loadPicker();
    return new Promise((resolve, reject) => {
      const view = new window.google.picker.DocsView(
        window.google.picker.ViewId.FOLDERS,
      )
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMimeTypes(FOLDER_MIME_TYPE);
      const picker = new window.google.picker.PickerBuilder()
        .addView(view)
        .setAppId(APP_ID)
        .setDeveloperKey(API_KEY)
        .setOAuthToken(accessToken)
        .setTitle("Google Drive에서 FC_quiz 폴더를 선택하세요")
        .setCallback((data) => {
          if (data.action === window.google.picker.Action.CANCEL) {
            resolve(null);
            return;
          }
          if (data.action !== window.google.picker.Action.PICKED) return;

          const selectedFolder = data.docs?.[0];
          if (
            selectedFolder?.mimeType !== FOLDER_MIME_TYPE ||
            selectedFolder.name !== FOLDER_NAME
          ) {
            reject(new Error("Google Drive에서 이름이 정확히 FC_quiz인 폴더를 선택해 주세요."));
            return;
          }
          resolve(selectedFolder.id);
        })
        .build();
      picker.setVisible(true);
    });
  }

  function disconnect() {
    if (accessToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(accessToken, () => {});
    }
    accessToken = null;
  }

  async function request(url, options = {}) {
    if (!accessToken) throw new Error("먼저 Google Drive에 연결해 주세요.");

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...options.headers,
      },
    });
    if (response.status === 401) {
      accessToken = null;
      throw new Error("Google Drive 연결이 만료되었습니다. 다시 연결해 주세요.");
    }
    if (!response.ok) {
      let detail = "";
      try {
        const body = await response.json();
        detail = body.error?.message ?? "";
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
      }
      throw new Error(
        `Google Drive 요청에 실패했습니다 (HTTP ${response.status})${detail ? `: ${detail}` : "."}`,
      );
    }

    return response;
  }

  async function listFiles(query) {
    const parameters = new URLSearchParams({
      q: query,
      spaces: "drive",
      pageSize: "100",
      fields: "files(id,name,mimeType)",
    });
    const response = await request(`${API_URL}/files?${parameters}`);
    const data = await response.json();
    return data.files ?? [];
  }

  async function getFolder() {
    if (!folderId) {
      throw new Error("Google Drive에서 FC_quiz 폴더를 먼저 선택해 주세요.");
    }
    return folderId;
  }

  async function getDeckFile(folderId) {
    const query =
      `'${folderId}' in parents and name = '${FILE_NAME}' and trashed = false`;
    const [file] = await listFiles(query);
    return file ?? null;
  }

  async function save(cards) {
    const folderId = await getFolder();
    const existingFile = await getDeckFile(folderId);
    const metadata = existingFile
      ? { name: FILE_NAME }
      : { name: FILE_NAME, mimeType: FILE_MIME_TYPE, parents: [folderId] };
    const boundary = `fcquiz_${crypto.randomUUID()}`;
    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: application/json",
      "",
      JSON.stringify({
        format: "fc-quiz-flashcards",
        version: 1,
        license: "Wikipedia-derived content: CC BY-SA 4.0; other card rights may vary",
        exportedAt: new Date().toISOString(),
        cards,
      }),
      `--${boundary}--`,
      "",
    ].join("\r\n");
    const method = existingFile ? "PATCH" : "POST";
    const filePath = existingFile ? `/files/${existingFile.id}` : "/files";
    const response = await request(
      `${UPLOAD_URL}${filePath}?uploadType=multipart&fields=id,name`,
      {
        method,
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      },
    );
    const savedFile = await response.json();
    if (!savedFile.id) throw new Error("Google Drive에 카드를 저장하지 못했습니다.");
    return savedFile;
  }

  async function load() {
    const folderId = await getFolder();
    const file = await getDeckFile(folderId);
    if (!file) throw new Error("Google Drive의 FC_quiz 폴더에 저장된 카드 파일이 없습니다.");

    const response = await request(`${API_URL}/files/${file.id}?alt=media`);
    let data;
    try {
      data = await response.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("Google Drive의 카드 파일이 올바른 JSON 형식이 아닙니다.");
      }
      throw error;
    }
    return window.FCDeckIO.validateDeck(data);
  }

  return {
    get connected() {
      return accessToken !== null && folderId !== null;
    },
    connect,
    disconnect,
    load,
    save,
  };
})();
