// My Mind for Windows: a window that runs https://savavlad.com in Microsoft Edge WebView2.
// Plain Win32 + WebView2 (static loader, static CRT), so the whole app is one small exe. Built by build.cmd.

#define NOMINMAX
#include <windows.h>
#include <wrl.h>
#include <WebView2.h>
#include <dwmapi.h>
#include <initguid.h>  // defines FOLDERID_LocalAppData in this file, so no import library is needed for it
#include <knownfolders.h>
#include <shlobj.h>
#include <shellapi.h>
#include <algorithm>
#include <cwchar>
#include <string>

#if __has_include("app_version.h")
#include "app_version.h"  // written by build.cmd: APP_VERSION "1.2.3" and APP_VERSION_NUM 1,2,3,0
#endif
#ifndef APP_VERSION
#define APP_VERSION "0.0.0-dev"
#endif
#define WIDEN2(s) L##s
#define WIDEN(s) WIDEN2(s)

using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;

constexpr wchar_t kClassName[] = L"SavaVladut.MyMind.Window";
constexpr wchar_t kTitle[] = L"My Mind";
constexpr wchar_t kStartUrl[] = L"https://savavlad.com/";
constexpr wchar_t kRuntimeUrl[] = L"https://go.microsoft.com/fwlink/p/?LinkId=2124703";
constexpr wchar_t kAppKey[] = L"Software\\My Mind";
// The site's page background (--bg in src/styles/app.css), so there's no white flash before it paints.
constexpr COLORREF kLightBg = RGB(0xfa, 0xfa, 0xf9);
constexpr COLORREF kDarkBg = RGB(0x14, 0x14, 0x13);

// The contract the website reads to know it's running inside this app (savavlad.com pages only).
constexpr wchar_t kDesktopScript[] =
    L"if (location.origin === 'https://savavlad.com') Object.defineProperty(window, 'myMindDesktop', "
    L"{ value: Object.freeze({ platform: 'windows', version: '" WIDEN(APP_VERSION) L"' }) });";

static ComPtr<ICoreWebView2Controller> g_controller;
static ComPtr<ICoreWebView2> g_webview;
static HBRUSH g_brush[2];  // light, dark
static WINDOWPLACEMENT g_beforeFullscreen{ sizeof(WINDOWPLACEMENT) };

static bool SystemUsesDark() {
  DWORD light = 1, size = sizeof(light);
  if (RegGetValueW(HKEY_CURRENT_USER, L"Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
                   L"AppsUseLightTheme", RRF_RT_REG_DWORD, nullptr, &light, &size) != ERROR_SUCCESS)
    return false;
  return light == 0;
}

// Dark title bar, window background and WebView2 background follow Windows' app mode.
static void ApplyTheme(HWND hwnd) {
  BOOL dark = SystemUsesDark();
  if (FAILED(DwmSetWindowAttribute(hwnd, 20 /* DWMWA_USE_IMMERSIVE_DARK_MODE */, &dark, sizeof(dark))))
    DwmSetWindowAttribute(hwnd, 19, &dark, sizeof(dark));  // Windows 10 before 20H1
  SetClassLongPtrW(hwnd, GCLP_HBRBACKGROUND, reinterpret_cast<LONG_PTR>(g_brush[dark ? 1 : 0]));
  InvalidateRect(hwnd, nullptr, TRUE);
  ComPtr<ICoreWebView2Controller2> controller2;
  if (g_controller && SUCCEEDED(g_controller.As(&controller2))) {
    COLORREF c = dark ? kDarkBg : kLightBg;
    controller2->put_DefaultBackgroundColor({ 255, GetRValue(c), GetGValue(c), GetBValue(c) });
  }
}

static bool IsFullscreen(HWND hwnd) { return !(GetWindowLongW(hwnd, GWL_STYLE) & WS_OVERLAPPEDWINDOW); }

// F11 and page fullscreen (a video's fullscreen button): the window covers its monitor, without a frame.
static void SetFullscreen(HWND hwnd, bool on) {
  if (on == IsFullscreen(hwnd)) return;
  LONG style = GetWindowLongW(hwnd, GWL_STYLE);
  if (on) {
    MONITORINFO mi{ sizeof(mi) };
    if (!GetWindowPlacement(hwnd, &g_beforeFullscreen) ||
        !GetMonitorInfoW(MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST), &mi))
      return;
    SetWindowLongW(hwnd, GWL_STYLE, style & ~WS_OVERLAPPEDWINDOW);
    const RECT& m = mi.rcMonitor;
    SetWindowPos(hwnd, HWND_TOP, m.left, m.top, m.right - m.left, m.bottom - m.top, SWP_NOOWNERZORDER | SWP_FRAMECHANGED);
  } else {
    SetWindowLongW(hwnd, GWL_STYLE, style | WS_OVERLAPPEDWINDOW);
    SetWindowPlacement(hwnd, &g_beforeFullscreen);
    SetWindowPos(hwnd, nullptr, 0, 0, 0, 0,
                 SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOOWNERZORDER | SWP_FRAMECHANGED);
  }
}

static void SavePlacement(HWND hwnd) {
  WINDOWPLACEMENT wp = g_beforeFullscreen;
  if (!IsFullscreen(hwnd) && !GetWindowPlacement(hwnd, &wp)) return;
  HKEY key;
  if (RegCreateKeyExW(HKEY_CURRENT_USER, kAppKey, 0, nullptr, 0, KEY_SET_VALUE, nullptr, &key, nullptr) == ERROR_SUCCESS) {
    RegSetValueExW(key, L"WindowPlacement", 0, REG_BINARY, reinterpret_cast<const BYTE*>(&wp), sizeof(wp));
    RegCloseKey(key);
  }
}

// Shows the window where it was last time, if that's still on a monitor; else centred, about 1200x800.
static void ShowWithSavedPlacement(HWND hwnd, int showCmd) {
  WINDOWPLACEMENT wp{};
  DWORD size = sizeof(wp);
  if (RegGetValueW(HKEY_CURRENT_USER, kAppKey, L"WindowPlacement", RRF_RT_REG_BINARY, nullptr, &wp, &size) == ERROR_SUCCESS &&
      size == sizeof(wp) && wp.length == sizeof(wp) && MonitorFromRect(&wp.rcNormalPosition, MONITOR_DEFAULTTONULL)) {
    bool maximized = wp.showCmd == SW_SHOWMAXIMIZED ||
                     (wp.showCmd == SW_SHOWMINIMIZED && (wp.flags & WPF_RESTORETOMAXIMIZED));
    wp.showCmd = maximized ? SW_SHOWMAXIMIZED : SW_SHOWNORMAL;  // never come back minimized
    wp.flags = 0;
    SetWindowPlacement(hwnd, &wp);
  } else {
    ShowWindow(hwnd, showCmd);
  }
}

static RECT DefaultRect() {
  RECT work{ 0, 0, 1280, 800 };
  SystemParametersInfoW(SPI_GETWORKAREA, 0, &work, 0);
  UINT dpi = GetDpiForSystem();
  int w = std::min<int>(MulDiv(1200, dpi, 96), work.right - work.left);
  int h = std::min<int>(MulDiv(800, dpi, 96), work.bottom - work.top);
  int x = work.left + (work.right - work.left - w) / 2, y = work.top + (work.bottom - work.top - h) / 2;
  return { x, y, x + w, y + h };
}

// WebView2 couldn't start: say why, offer Microsoft's WebView2 Runtime download page, and close the app.
static void FailToStart(HWND hwnd, HRESULT hr) {
  if (hwnd && !IsWindow(hwnd)) return;  // the window was closed while WebView2 was starting
  const wchar_t* why = hr == HRESULT_FROM_WIN32(ERROR_FILE_NOT_FOUND)
      ? L"My Mind runs on the Microsoft Edge WebView2 Runtime, which isn't installed on this PC."
      : L"My Mind couldn't start Microsoft Edge WebView2.";
  wchar_t text[512];
  swprintf_s(text, ARRAYSIZE(text),
             L"%ls\n\nOpen Microsoft's download page for the WebView2 Runtime now? "
             L"Install it, then open My Mind again.\n\n(Error 0x%08lX)",
             why, static_cast<unsigned long>(hr));
  if (MessageBoxW(hwnd, text, kTitle, MB_YESNO | MB_ICONWARNING) == IDYES)
    ShellExecuteW(nullptr, L"open", kRuntimeUrl, nullptr, nullptr, SW_SHOWNORMAL);
  if (hwnd) DestroyWindow(hwnd);
}

static void ResizeWebView(HWND hwnd) {
  if (!g_controller) return;
  RECT bounds;
  GetClientRect(hwnd, &bounds);
  g_controller->put_Bounds(bounds);
}

static bool OpensInBrowser(const wchar_t* uri) {
  return _wcsnicmp(uri, L"https:", 6) == 0 || _wcsnicmp(uri, L"http:", 5) == 0 || _wcsnicmp(uri, L"mailto:", 7) == 0;
}

static void OnControllerCreated(HWND hwnd, ICoreWebView2Controller* controller) {
  g_controller = controller;
  if (FAILED(g_controller->get_CoreWebView2(g_webview.ReleaseAndGetAddressOf())) || !g_webview) {
    g_controller->Close();
    g_controller = nullptr;
    FailToStart(hwnd, E_FAIL);
    return;
  }
  ApplyTheme(hwnd);  // the WebView2 background colour
  ComPtr<ICoreWebView2Settings> settings;
  if (SUCCEEDED(g_webview->get_Settings(&settings))) settings->put_IsStatusBarEnabled(FALSE);
  ResizeWebView(hwnd);

  EventRegistrationToken token;
  // target=_blank links and window.open go to the default browser. Navigations in the page itself stay here,
  // including sign-in with GitHub or Spotify, which goes through their sites and back.
  g_webview->add_NewWindowRequested(
      Callback<ICoreWebView2NewWindowRequestedEventHandler>(
          [](ICoreWebView2*, ICoreWebView2NewWindowRequestedEventArgs* args) -> HRESULT {
            LPWSTR uri = nullptr;
            if (SUCCEEDED(args->get_Uri(&uri)) && uri) {
              if (OpensInBrowser(uri)) ShellExecuteW(nullptr, L"open", uri, nullptr, nullptr, SW_SHOWNORMAL);
              CoTaskMemFree(uri);
            }
            args->put_Handled(TRUE);
            return S_OK;
          }).Get(),
      &token);
  g_controller->add_AcceleratorKeyPressed(
      Callback<ICoreWebView2AcceleratorKeyPressedEventHandler>(
          [hwnd](ICoreWebView2Controller*, ICoreWebView2AcceleratorKeyPressedEventArgs* args) -> HRESULT {
            COREWEBVIEW2_KEY_EVENT_KIND kind;
            UINT key;
            COREWEBVIEW2_PHYSICAL_KEY_STATUS status;
            if (SUCCEEDED(args->get_KeyEventKind(&kind)) && kind == COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN &&
                SUCCEEDED(args->get_VirtualKey(&key)) && key == VK_F11) {
              if (SUCCEEDED(args->get_PhysicalKeyStatus(&status)) && !status.WasKeyDown)
                SetFullscreen(hwnd, !IsFullscreen(hwnd));
              args->put_Handled(TRUE);
            }
            return S_OK;
          }).Get(),
      &token);
  g_webview->add_ContainsFullScreenElementChanged(
      Callback<ICoreWebView2ContainsFullScreenElementChangedEventHandler>(
          [hwnd](ICoreWebView2* sender, IUnknown*) -> HRESULT {
            BOOL full = FALSE;
            sender->get_ContainsFullScreenElement(&full);
            SetFullscreen(hwnd, full != FALSE);
            return S_OK;
          }).Get(),
      &token);

  // Open the site once the script is in place, so the very first page already sees window.myMindDesktop.
  g_webview->AddScriptToExecuteOnDocumentCreated(
      kDesktopScript, Callback<ICoreWebView2AddScriptToExecuteOnDocumentCreatedCompletedHandler>(
                          [](HRESULT, LPCWSTR) -> HRESULT {
                            if (g_webview) g_webview->Navigate(kStartUrl);
                            return S_OK;
                          }).Get());
  if (GetFocus() == hwnd) g_controller->MoveFocus(COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC);
}

static void StartWebView(HWND hwnd) {
  // The app's own browser profile, in %LOCALAPPDATA%\My Mind (not beside the exe, which is often in Downloads).
  PWSTR base = nullptr;
  HRESULT hr = SHGetKnownFolderPath(FOLDERID_LocalAppData, KF_FLAG_CREATE, nullptr, &base);
  std::wstring dataDir = SUCCEEDED(hr) ? std::wstring(base) + L"\\My Mind" : std::wstring();
  CoTaskMemFree(base);
  if (SUCCEEDED(hr)) {
    CreateDirectoryW(dataDir.c_str(), nullptr);
    hr = CreateCoreWebView2EnvironmentWithOptions(
        nullptr, dataDir.c_str(), nullptr,
        Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
            [hwnd](HRESULT result, ICoreWebView2Environment* env) -> HRESULT {
              if (!IsWindow(hwnd)) return S_OK;
              if (FAILED(result) || !env) {
                FailToStart(hwnd, FAILED(result) ? result : E_FAIL);
                return S_OK;
              }
              HRESULT created = env->CreateCoreWebView2Controller(
                  hwnd, Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                            [hwnd](HRESULT result, ICoreWebView2Controller* controller) -> HRESULT {
                              if (!IsWindow(hwnd)) return S_OK;
                              if (FAILED(result) || !controller) FailToStart(hwnd, FAILED(result) ? result : E_FAIL);
                              else OnControllerCreated(hwnd, controller);
                              return S_OK;
                            }).Get());
              if (FAILED(created)) FailToStart(hwnd, created);
              return S_OK;
            }).Get());
  }
  if (FAILED(hr)) FailToStart(hwnd, hr);
}

static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
  switch (msg) {
    case WM_SIZE:
      ResizeWebView(hwnd);
      return 0;
    case WM_MOVE:  // keeps dropdowns and other popups under the page where they belong
      if (g_controller) g_controller->NotifyParentWindowPositionChanged();
      break;
    case WM_DPICHANGED: {
      const RECT* r = reinterpret_cast<const RECT*>(lParam);
      SetWindowPos(hwnd, nullptr, r->left, r->top, r->right - r->left, r->bottom - r->top, SWP_NOZORDER | SWP_NOACTIVATE);
      ResizeWebView(hwnd);
      return 0;
    }
    case WM_SETFOCUS:  // back to the app: keyboard focus goes into the page
      if (g_controller) g_controller->MoveFocus(COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC);
      return 0;
    case WM_SETTINGCHANGE:
      if (lParam && lstrcmpW(reinterpret_cast<LPCWSTR>(lParam), L"ImmersiveColorSet") == 0) ApplyTheme(hwnd);
      break;
    case WM_DESTROY:
      SavePlacement(hwnd);
      if (g_controller) g_controller->Close();
      g_webview = nullptr;
      g_controller = nullptr;
      PostQuitMessage(0);
      return 0;
  }
  return DefWindowProcW(hwnd, msg, wParam, lParam);
}

int WINAPI wWinMain(_In_ HINSTANCE instance, _In_opt_ HINSTANCE, _In_ PWSTR, _In_ int showCmd) {
  // One window: opening the app again brings the open one to the front.
  CreateMutexW(nullptr, FALSE, L"Local\\SavaVladut.MyMind");
  if (GetLastError() == ERROR_ALREADY_EXISTS) {
    if (HWND other = FindWindowW(kClassName, nullptr)) {
      if (IsIconic(other)) ShowWindow(other, SW_RESTORE);
      SetForegroundWindow(other);
    }
    return 0;
  }

  if (FAILED(CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED))) return 1;
  LPWSTR runtime = nullptr;
  if (FAILED(GetAvailableCoreWebView2BrowserVersionString(nullptr, &runtime)) || !runtime) {
    FailToStart(nullptr, HRESULT_FROM_WIN32(ERROR_FILE_NOT_FOUND));
    CoUninitialize();
    return 1;
  }
  CoTaskMemFree(runtime);

  g_brush[0] = CreateSolidBrush(kLightBg);
  g_brush[1] = CreateSolidBrush(kDarkBg);
  WNDCLASSEXW wc{ sizeof(wc) };
  wc.lpfnWndProc = WndProc;
  wc.hInstance = instance;
  wc.hIcon = LoadIconW(instance, MAKEINTRESOURCEW(1));  // the small icon is picked from the same resource
  wc.hCursor = LoadCursorW(nullptr, IDC_ARROW);
  wc.hbrBackground = g_brush[SystemUsesDark() ? 1 : 0];
  wc.lpszClassName = kClassName;
  RegisterClassExW(&wc);

  RECT r = DefaultRect();
  HWND hwnd = CreateWindowExW(0, kClassName, kTitle, WS_OVERLAPPEDWINDOW, r.left, r.top, r.right - r.left,
                              r.bottom - r.top, nullptr, nullptr, instance, nullptr);
  if (!hwnd) {
    CoUninitialize();
    return 1;
  }
  ApplyTheme(hwnd);
  ShowWithSavedPlacement(hwnd, showCmd);
  UpdateWindow(hwnd);
  StartWebView(hwnd);

  MSG msg{};
  while (GetMessageW(&msg, nullptr, 0, 0) > 0) {
    TranslateMessage(&msg);
    DispatchMessageW(&msg);
  }
  CoUninitialize();
  return static_cast<int>(msg.wParam);
}
