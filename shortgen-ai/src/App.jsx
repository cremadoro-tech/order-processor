import { useState, useRef, useCallback, useEffect, Component } from "react";

/* ─── Error Boundary ─── */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1A202C", fontFamily: "'Public Sans', sans-serif" }}>
          <div style={{ textAlign: "center", maxWidth: 420, padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 10 }}>予期しないエラーが発生しました</h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 24, lineHeight: 1.6 }}>
              {this.state.error?.message || "アプリケーションでエラーが発生しました。"}
            </p>
            <button onClick={() => window.location.reload()} style={{ padding: "12px 32px", background: "#f06a28", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 3px 12px rgba(240,106,40,0.3)" }}>
              ページを再読み込み
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─── Firebase Auth（CDN経由で動的ロード） ─── */
let _firebaseAuth = null;
let _googleProvider = null;

async function getFirebaseAuth() {
  if (_firebaseAuth) return { auth: _firebaseAuth, provider: _googleProvider };
  const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
  const { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } =
    await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");

  const firebaseConfig = {
    apiKey: "AIzaSyCSxYGAlNvRQaxlDeaH4FguphZexEH7UbI",
    authDomain: "shortgen-ai.firebaseapp.com",
    projectId: "shortgen-ai",
    storageBucket: "shortgen-ai.firebasestorage.app",
    messagingSenderId: "732701913605",
    appId: "1:732701913605:web:5d71fa162cdd4b711f226c",
  };
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  _firebaseAuth = getAuth(app);
  _googleProvider = new GoogleAuthProvider();
  // 便宜上globalに保存
  window.__fbSignIn = () => signInWithPopup(_firebaseAuth, _googleProvider);
  window.__fbSignOut = () => signOut(_firebaseAuth);
  window.__fbOnAuth = (cb) => onAuthStateChanged(_firebaseAuth, cb);
  return { auth: _firebaseAuth, provider: _googleProvider };
}

/* ─── ログイン画面 ─── */
const LoginScreen = ({ onLogin, loading }) => (
  <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #1A202C 0%, #2D3748 50%, #1A202C 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ background: "#fff", borderRadius: 20, padding: "48px 44px", width: 400, textAlign: "center", boxShadow: "0 32px 80px rgba(0,0,0,0.4)" }}>
      <div style={{ width: 64, height: 64, background: "linear-gradient(135deg, #f06a28, #e8420a)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "0 8px 24px rgba(240,106,40,0.4)" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="#fff"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z"/></svg>
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 900, color: "#1A202C", letterSpacing: "-0.03em", marginBottom: 8 }}>ShortGen AI</h1>
      <p style={{ fontSize: 13.5, color: "#64748B", marginBottom: 36, lineHeight: 1.6 }}>商品画像からSNS動画を自動生成<br/>EC向けショート動画制作ツール</p>

      <button
        onClick={onLogin}
        disabled={loading}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "14px 24px", background: loading ? "#F4F6F9" : "#fff", border: "1.5px solid #E2E8F0", borderRadius: 12, fontSize: 14, fontWeight: 700, color: loading ? "#94A3B8" : "#1A202C", cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", transition: "all 0.2s", marginBottom: 16 }}
        onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.12)"; }}
        onMouseLeave={e => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)"}
      >
        {loading ? (
          <div style={{ width: 20, height: 20, border: "2px solid #e0e0e0", borderTopColor: "#f06a28", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        )}
        {loading ? "ログイン中..." : "Googleでログイン"}
      </button>

      <p style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.6 }}>
        ログインすることで<a href="/terms" onClick={e => e.preventDefault()} style={{ color: "#f06a28", textDecoration: "none", cursor: "pointer" }}>利用規約</a>および<br/>
        <a href="/privacy" onClick={e => e.preventDefault()} style={{ color: "#f06a28", textDecoration: "none", cursor: "pointer" }}>プライバシーポリシー</a>に同意したものとみなします
      </p>
    </div>
  </div>
);

/* ─── Icon ─── */
const Icon = ({ name, size = 20, color = "currentColor" }) => {
  const paths = {
    movie_edit: "M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z",
    link: "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z",
    grid: "M3 3h7v7H3zm0 11h7v7H3zm11-11h7v7h-7zm0 11h7v7h-7z",
    history: "M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z",
    check_circle: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
    auto_awesome: "M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z",
    palette: "M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z",
    description: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
    play_circle: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z",
    person: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
    play_arrow: "M8 5v14l11-7z",
    refresh: "M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
    arrow_back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
    download: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
    add_photo: "M21 6H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 14H3V8h18v12zM9 12c0-1.66 1.34-3 3-3s3 1.34 3 3-1.34 3-3 3-3-1.34-3-3zm-3 8h12v-1c0-2-4-3-6-3s-6 1-6 3v1z",
    close: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
    check: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
    mic: "M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z",
    music_note: "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z",
    share: "M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z",
    drag: "M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z",
    expand: "M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z",
    collapse: "M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z",
    timeline: "M23 8c0 1.1-.9 2-2 2-.18 0-.35-.02-.51-.07l-3.56 3.55c.05.16.07.34.07.52 0 1.1-.9 2-2 2s-2-.9-2-2c0-.18.02-.36.07-.52l-2.55-2.55c-.16.05-.34.07-.52.07s-.36-.02-.52-.07l-4.55 4.56c.05.16.07.33.07.51 0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2c.18 0 .35.02.51.07l4.56-4.55C8.02 9.36 8 9.18 8 9c0-1.1.9-2 2-2s2 .9 2 2c0 .18-.02.36-.07.52l2.55 2.55c.16-.05.34-.07.52-.07s.36.02.52.07l3.55-3.56C19.02 8.35 19 8.18 19 8c0-1.1.9-2 2-2s2 .9 2 2z",
    compare: "M10 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h5v2h2V1h-2v2zm0 15H5l5-6v6zm9-15h-5v2h5v13l-5-6v9h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z",
    info: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
    image: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z",
    title: "M5 4v3h5.5v12h3V7H19V4z",
    font: "M9 4v3h5v12h3V7h5V4H9zm-6 8h3v7h3v-7h3V9H3v3z",
    layers: "M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z",
    transition: "M17 2H7C5.9 2 5 2.9 5 4v16c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H7V4h3v2H8v2h2v2H8v2h2v2H8v2h2v2H7v-2h3v-2H8v-2h2v-2H8V8h2V6H8V4h9v16z",
    overlay: "M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z",
    text_fields: "M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z",
    video_cam: "M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z",
    smart_display: "M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM10 8v8l6-4z",
    tune: "M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z",
    star: "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
    bolt: "M7 2v11h3v9l7-12h-4l4-8z",
    speed: "M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z",
    add: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0, display: "block" }}>
      <path d={paths[name] || paths.info} />
    </svg>
  );
};

/* ─── Data ─── */
const TEMPLATES = [
  { id: "product", label: "製品イントロ",       desc: "洗練された製品プロモーション",       category: "製品紹介", popular: false, platforms: ["tiktok","reels"],         thumb: "data:image/jpeg;base64,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" },
  { id: "sale",    label: "セール告知",          desc: "期間限定プロモーションに最適",       category: "SNS広告",  popular: true,  platforms: ["tiktok","reels","shorts"], thumb: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCADhAZADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD0wUUlFfhB9cLSUtFABRRRSAWlptKKAHUUgpaACiiikAUopKKBDqTvRRQAtFFFABRRRSAUdaWobiUQQPJj7oJrz+68Xyz3DRIQiA4zXfgsBVxjaprRA2luehSXEUfDOo/GmLewHo4rhYL0TAM0oY/WrcuqQ2kO9iuK96lw3Br35MhztsjrmvYV75pY76KRsA81zsN/BLbrKGGD71ZilRlVhjnpWy4copfE7ke0fY6IcjIpap28hCjPSrYII4r5rH4CeDnZ6ruaRlccKUUgpa88sKWkpakY6g0LRQJhS0lApCFopCaAaAFooooAKKKKACiiigApRSUUALTqbRSJHUUUUAZQpaQUtdJYUZoooAM0UUUALSim5pQaAFpc0maM0rAOpM0maTNFgHZozTc0UWEPBpaaDS0WAXNGaSiiwDs0U3NLSAg1JgtjNu6bT/KvErcedqMw6jca9f8AFEcsujzrAcSFTivLfBfh/U9U1dkRWit1J8yZuAPpX1/DVO6k1uY1ZKOrMPxGLrRZ1uYZCYD1BPSsnUfETX8SQwykk/er6UXwZ4fS1VLyFbjPeTqfoK4rU/hVpGo6v/xL4PsqA5cqe1fbKkktdzzpYq70PMoteki09bdXIccA5ruPDF/LOYFlf7o55rPk+GUVz4nktLW5fyYF3bT1NdD4c8NWt6XXSLoi5tW2SxMecisJ0tLmsa0TtbdhJEMelSxyFW2npUdpZ3FnEFuUwadMmelefisFHE03CojWE1F3RcDAgYNLVK3mwdrfrVxSCOK/O8bgp4SpyS+87Iy5lcdS0lLXCWKKWko70hC0UUUAApaSgUhC0UUUAFFFFABRRRQAUUUUAFKKSigQ5aWmg0uaQGXmjNJmiuqxQuaBSUuaLAFLTSaM0WAdQKQGigB1FJQaQBRRSU7CFpaSikA7NKOTTe1UtYv0sLRnJG48KPU1vhsPPEVY0qa1ZnUqRpxcpbIvkhRycUIwbO0g464rzVpJrqc7pJGYnnLHAra0m6FjMoXkdGJ7197T4Aq1KMpxqXkltbr2Pna/ElKjUUZR0f8AVzsaR22xk9xSoysgZeVPI96sxRKBvl+76V8NTwdSdV02rWevkfRe0i0pJ6P8TzaW91fWL+ee5I07Q7ZsNI4w03sK62z1KGzsUmaLy4WO23gH3pT6mruraHba00LXSsYoG3JCDgE+pFY+u/8AFM28+samBdXKjbbwqPljX2r9Dy5UKdJKnHl/X/hzzainKTu7l7UNVGj27X+qupvpVxFBn/Vj6Vq+FvOGnRyTMTc3Z81s9h6V8+aRq9/4y8a263RZmeTJXnCrnpX0fpCbbuY9I4IwijtXqRbctTCUUkYPh5U/4TjUQhyRHhqWwsrW38Qz3NoFt77d84HAkFY3wzvhf+Ltek3gkOVH51J8TLg6XdQ3cLbJH+6aclYcUmz0dp4bmPybhAN3QnsawdRs3tJSrfcP3TWb4O8SQeILUW85VLsD1+9Wut2Ukaw1DnH3GPaiVpxHBuD1MiRRiiOZovvZIqa+ha2l2vwvZvUVAGVu9eRi8HTrx5KiO+nPS6L0M6ydCM1MDWBdS+QpdSARXOXPiy7F4kUSqIwfmPc18rW4brSqctDVG8qyhHmZ6GDS96ydK1aG8jU7gH7qTWoDnpXg4vB1cLP2dWNmXCpGorxHUtNpc1yGgtFJmlp2ZAtFFFSAUUUUAFFFFAwooooAKKKKAClzSUUAZdFJSV1DH5pKSigBaKbRmgB1LTQaM45ppdgsOqJZ4jKYxIhcdVB5rhviN42h0O1e2tnDXT56HpXhi+IdTTUzfRXcsdwTncG7elfS4Dh+WIpOpUdr7HjYzN4UJ8kVc+sM80Zrxvwl8Ws7IPEEeD089On4ivVdM1Sz1O3WaynSVGGcg15mNynEYT41dd0dmGx1HEK8HqaANLTRS88V5ljs8gkdY42dzhVGTXA6rftqV6XGfLBwgrW8V6lvP2KFuM/vCP5VzNzMtrCccSHt6V+ncG5A/wDeai1e3ku58pn+axoRce34iXl8tmmxCDJ/Eaq2epkyAs3esK8uC7kk5qmsrA/KSK/VaNqVoR2R+cVouvec37zPavC2qxsPJkO4dU9j6V06kyNvk+6OAK8E0rXJbKRSxJAPrXr2geJbXVNKd42AuVUKUz096+Mz/hpYrERr0FaLfvLu+7Pr8izx0qMsPiHqloy3NqckN4ZYjjBxj1FQ6zCmvafIHOSynj0NZN7OEBNN0vUGgmbI+RxjHpWnEGRfWMF/s+lSCTVuvqGVZvKliv3jvGffoc58PPDsmjeLL+5uo8LFH+7b1Jr0rWr3+zvCep3i5DrbM3HrisiSORbTzCBulkA/Cug8QxRzeFrqOQBlePYR+FeJgpz9hzVd0j6isldcuzPE/wBnPUml8R3yTsfMuELcn1rsPijJLd+E7pgN81hcbT67a4vwNY/2H4/s3iBVWJUj2r1HV7WKbX9Z06X/AFeoW+9Qem7Fb86lqibOMjw7w3r00F7DNA5V1wRg817rpmpp4t0lXiZY9ThHKk/fxXzRd2d9o19LCyNmNivTsDWz4d8Y3WlX8U0YdHQjOAelO62Rpe+p9H6Pqdvq1u+n3/7q8jGMH1rnNTu20u7eG4GGB4J9Kh1VJvEGlQ+IdBYLqEK7mjTjzB3qewns/iFoTxtiDV7cYI6MrD1pSpqorDhU9m7swdY19BE3zYOOOa5D7ZulL7sGqGt297pepy2uoIyyo2BnuPUVSS4y3Nb4bD+zV3uY4iv7R2jsdTa6pNHKGjcg+ors9E8UyDal2Ny/3s815lbzDeOa0rRppXAiDH37Cli8DQxceWtG5lSqTpv3D2y0u4rmMPG4YVJPcQ28bSzSLGijkscAV5TDrqaOn+v3zY+6pyB9a4nxJ4vvNTmYXVwZFHAjjOFFfKx4I9rWvGdofifTYam5QVTENRX4/cemeJ/iTbWxeDSI/PlHHmtwo9/euJ0rx1q9prQvLq4e4jfiSJvulf8AZHauX0e/P2rEoQo4KkY6A0+eHypXRv4Tj619nhOHcBhqLpQp3vu3uevl0sLilKFJbdXuz6W0fUrbVbCK6tJA8bjI/wDr+9XDXgXgPxRJ4e1ARzMzWExAkX+4f7wr3i2mjuIElgYPG4BDDkGvyviPIp5VXbjrB7P9Dz8ZhHh526Mlpc02lr5o47i0ZpuaWgdxaKSigLi5ozSUUBcXNFJRQFzJpabRmusY6im5ozRYBaKTNFOwCg5rhviJ42g0C0eCBw14wwAO1P8AiL40h8N2TRROrXsgwqjtXznqeoXGpXT3F1IXkc5JJ6V9XkeS+0axFdadEeHmeZez/dUt+o/UtRn1C6e4uXLyOcnJ6VXDColWlxX23KkrI+YlqybdWlomvaholx5un3Dx46rng1kU4EdT0HWpcFJWaCLlB3iz3Twl8UobmNI9XVIpDxuB613V34is/wCzjNZzLI7j5QDmvkeSR5plWMEyMdqgV7D4G0trLT089mOBuck9/SuKHC+HxdZTgrPt0Z6zzipQot1HodWZNitPLy7HOT3Nc9ql2zyNk8mrup3hbOOAOAPQVz077myea/SqGHjhKapwWp+f18TLHVnVn8K2I5H3Gm5ApprI1LV0t2ZIslh3q5SUFeRcKcqsrRRpXVzFAMyNj0HrXoPw4hePRZL6UbWuG+QH+4O/55ryDRrW51zVIYuWaRgPoPWveooltNNiht1IgiQIGxxx71hGupu+yOyeG9il1ZHfS73AzwKYZAvNVZZMHOap3d3tG1T2rSU0kTCnKTR3nh66bULUIx3GEitbV5i2mtARyXFYPw/i22csjg7pDn8BXRXa+ZEHI/ir8+zurDDwqTpn32WxlOMVPdHmM0Wzxtbqo6DNdzr58rWNKvm/65sfY4rjhmbx1wOFHWu31WD7Vp7RgfPGQy185hMXJVI0pdY3PVqUr6mH4w0q1e7lnSFDIvzAY+8KqeHbLQtThybOHzhwwIGa6O6tft2lxSD/AFyrtPrXDX9n/YEUuqS3KwbT9zP3z6AUq2Hli5SpQk1JaocJKKTaO7s5NP8ADWMMsEEh24zxn/CuN8b2V14W1hfFfh9S8DHN1CnQg96851jxJqGrazBLqG6GCQFII+gA7mrtl4q1bTYHt4bkyWrqVaCYb0/I19fkmSV44Ne0qKUl/W5y4hc09FY9N1JNL+J3hkXdg0aajGuQCecjqDXjMtheW15JbXMRjkjfa27gfWk0vW7jQ55ptMAgeQknYcDn2po1KbU7tnnd2mfkuxzk16f1OtHRomjh6Td6ki7Fti6ne3p2qK/1vyV2M7f9c0OBWDe6nJFK0bZXHBAqhLcBxuUdaunhv5js9vToK1COvfqXby/mushm2J/dXiqOMdKg87mpEk3cV1xglscdScqjvJ6lu3ba4OfrXRSv9otYZzy2Nr/UdP0rmUBrY0aYPvt3PEg49m7VUezO7KsW8NiIyez0ZIxGK9B+F3i82U66TqMn+jSHEDsf9Wf7v0rzt1IJDdRwahY4Oe46Vw5jgKWPoOhVW/8AVz7bE0414Wlt0Pq4cgHtTs15p8LPGI1CFdK1GQfa4hiJ2PMi+/vXpP8AnivwzNMsqZdXdGottvM+Xq0ZUpOLFopBSV5piOpM0lFIY6ikooELRSUUAY+aM0zNGa7bFD80uajzRRyiH54rj/iB4zt/DenssbB75xhEHb3NSeOvF1r4ZsCWYPeuP3UQ6/U+1fOWr6lc6tfS3d5IZJHOcnt7V9LkuTfWGq1Ze6vxPIzLMFRTpw+J/gM1fULnVL6S5u5C8rHJPpVVV9acoAFLmvuVZKyPlJSbeoBQKRqC1Rk00hJXHfeIA6mob2UIBGpyF+97mpnYQQ+YfvNwtM0PT5NX1RIEBKZBY46+1bUqbmzWnH7T2Om+HegS6heLcumSx2xg9h617DeRQ2dqlvEc7RyfU0aDpUeh6WF2qJ2Azj+EelZ2p3JZmOa+wy7CqjDna1Pl84xrry9lDYyL19zEg1nSGrEr7iRVWSut6u5ywXKlFFTULgW9q7nGccVxoLXNxx8xY1qeJLrfKtuh6dfrV3wvpgLCeRehG3615uJm5z5InvYKkqVPnfU6nwvaromh3+qzALJHEVU/7RHavWvAqSQ+BNNW/XfLOnmupHZuR+hFeb+J7J5LTRfD0BAmvZkVwPUnmvYLtUgWO3iwIo1CKB6DgV+d8dYx05UsNTdnufRZBR9r7StNX6HN6toscgZ7NjGx/gbkVzEOlXMmpLBcoyAnr2Irs9TvY7SBnlbao/nWNo+pf2ldFl+6uMV5GD4lzGnh5Rk+ZWtd7o9WeU4eVRTirdy7eeJLbw8/2e0hM8qpgoThVPua5y48TanfgrLOY4ucRxfKP/r1j+IJzLr+oKcHbKVzRarwBVyxNSdFRqO59XhMDRpJSS1Ons7lLK7t7iRC5EYyR1rrLTXbSeeLy3+9xhuK4u9HzIPRAKphjFKsgONnzZrgpwh7aNV7o6sTgo1ou2jPQL7UmhsdSW3XM0I3BTxmvGna81e/+3a3J5kgOY4M/JF+FXdT8TXV9dTDftVztO0Y3D3qtGcgda9ydWMPegrNrfqceFy7ld6utjK8bKY7C2uhwYJlJI9D1qtdMHRXX7rDNbPii3+1eHb1FGT5e4fUc1y+jXH2nSIXY5IGw+1fXcJYjnhKkzz84hy1U11RHOCKjtJTHcI2ejc1PcDrVJuGr6mpGzPHuS+KYNlysy/ckXIrAeVlHBrq74C80EHq8J/SuUkXgj06V51WPKzRaoYtyO4qzBOhYc4rMYkVJG3INZ3FY6CFgR61NFJ5UgdTgg5BrOsXz1q43GaaZJv3ZEmydPuyjP496qMKfosn2i2ltT98fOg9+9Iwq7XVz7nK8SsTh03utBsE0ttcJPA5SVDuVhxg17z4E8ZQa7p6pdMsd/EuJE/ve4rwRhU+nX02n3sdzbsQyHOB0I9K8POMmoZpT5Kq1WzKxmG9rCy3PqRWBHBH4Gn4ry7w/wCLZZbaOWFwVPDIf4T/AIV2em+ILe6wsn7tvc1+XZjwvisI24e8j5b2yjN06iszdopiSK65UjH1p9fMzpyg7SVmdGj2CikzS1NhC0UlLmgRhZpCaZmjNd/KMfXN+NfFdr4Z05pJG33bgiGIdSfX6U/xf4mtPDWnPPcMDMR+7iB5c185a9q93reoyXt7IXkc8DPCj0FfQZNlDxUva1fgX4nk5jmKwy9nB+8/wI9a1W71nUJLy9kMkrnPJ6ewqlzSquKd0FfdxSiuWOiPk5Tcnd7idqaaXvSMcUWERs2BzRar50hY8Rr941XdmmlEcfOetT37ra24toz83VzWqj0NlHoVbyZrm4AjGSflRa9s+FXhZdN05L+7TEr8puHJNcV8JvCLa1qH2+8Qi0hOeRwxr3K6KxR7UG1VG0AelfQ5bg72nI87M8X7KPsofMoapcYBGa5K9lyx5rX1GR5HWNAzO2cKoyT9AOtFv4J8T6jGJbbRbxoz0Zk2g/TNe3Vqxh7rdj52lQnVfOk2cqx5NUr+cQW7yE9K7S8+H3iy2jLyaHeFRySgDfyNec+KY7iG6SxuIZYJTyUkQq35GsZ14KDcXc7aGEqSmueLRk6fA17dGRxwW6mvTPCVgJr2FCmYoh5j/h2rldFtNgUY4FekaNGum+H7i8k+V5AWB/2R0rloxs3JnpYmp7vLEk8IQ/218T57ojdBpcGQT2kbgfpXeXzgSO5OABya5v4P2RtvCdxqcv8ArdTnafP+x0UflV7xJM0enTEZyeOK/Es+xLzDNajWqTsj7vKsP9Xw0YM4Lxjq73V0URv3SnArT+HwLiVz3OK4vUy7XJwrEfQ13/gKEx6eHdSuTzkdq6cVS9lheVI74P3jjdSk3+I9Ux/z8N/OtSzHzJ7msKZs+IdU/wCvl/51v6eN00I962rK0V6I+kw3wI2bwfvT7AfyrnvEd4Le1MaH9447V0V5zM31ri/FUb/a9wVipXqAcVnhIqU7HVUdomHC58wYPet6HJUGudiV/MHyP1/umuhtD+7FeliI2VzChJPqaLRiW0ePrvUr+YrzPwu/lTXti3BjckfgSK9OtzhAa8u1EHTPHNwrcI8mfqGr1+Ga/s8S4nlZ5T92MvkbMq8HNUZV5rSlGQR6VVlifP3G/wC+TX6TWWiZ80O0qQCUxSf6uUbCPeufu4TBdSxHqpIxWwiyK4IR+OR8pqv4ht5XaG9jicq/ythT1FefWV1ccXbc5+5TaxqJDzV+WF5Ic7Hyf9k1QKPGfnRl+oxXIyrov2b4IrWByAawbd8PW3bNuSmmJoktZ2tbqOVTgqfzFb12qlxJGP3co3rXOTDI461r6NcfabF7dj88PzqfUdxVw7HrZNivY11F7McRUTVYYZXI61Ey8UpI+zlEs6RfyafdBwMxHh19a7a11Deqyo3yHkGvPSMVoaTem3byZSfKc8H+6a4sRRUlzHgZvl31iHtIfEj02y8QXFrjynyvcE12WkeI7a7VVlcJIfU15Ck5iXD9T0q1DchCCWr5nMMmw2NXvxs+6PkKdepQdj3BGVwCDkeoqTFeWaP4mntiFDF0HYmu60jXrXUEUB1WTupNfBZlw7iMH70PeienSxUKmhs0UisDS1861ZnUc7nisTxZ4jtPDumNc3TAyYIjjB5c+3tSeKfENp4d0x7q6YbzxHH3c+1fPXiPV7zX9Se7vXJJ4RB0Qegr6zKcpeLl7SppBfieVmOYrDR5Y/E/wI/Eet3mv6jJd3rklvuqDwo9BWaq+tPC08CvuoqMIqMVZHyFSq5u8iMikqQimGmmQmRkVUuZSzbE6mrM7bV460unWpaQyuOBzzWsWkrs3houZi2sa2Nq1w/3jwgPrR4W0S58T67HbRAlCd0jnoq+9Vb15NR1CO1tFZyW2Ii9Sa+hfh94Xh8L6KiOFa/mAaZx6+gPoK9PL8K607yJxGIWHp87+Jm5pdhb6PpsVnaLtiiUDkfePrVrSdJufEWqpZWQwCNzyn7qL3P/ANaq95KFUk8Yr134VaUtl4bS6ZcXF4fNc98dAPy/nX0OJrfV6V477I8PCUPrte0tt2afhjwlpegRKLa3VrjHzXEgy7H69vwrocCobu4is7Wa4uGCQxIXdj0CgZJr5y8Y/GTXL29lj0GRNPslYhHCBpHHqScgZ9q8OlSq4qTZ9JWr0cFFK1vQ+kgBzwKyfEPhzSfENqYNYsYLpMYBdfmX/dbqPwr5js/jB4y0yZZXvo71M8xXMSlT+KgEfnXpNx8cbG58ImexgaLXnPlC1b5lQ/8APTPdR6dac8LUpy5R08ZSrQ5mcD4x8G2vh7xaul6befaY5Tv2k5eEH+FuPTp39areP2caXb6XZj97dyLbIvseKn8JpNd3d1ql47yzMeZH5LMTyf8APrUui2x1v4nQZOYNJgM7d/3jfKv5ZzWuaYr6hl1StJ6pM8rD0/reNjBLS56KltFpek21jbjENvEsaj2ArsfAGnxnS5bieNHM0hxuUHgcVx2pOWO0dScDNepaJaiy0u2gA5SMZ+vevyvhPD+3xMq01t+bPucdPkpqCJTp9n/z62//AH6X/CqWuaXBPo91FFDEjFCVKoByOaW81qC28Q2GkyA+beRSyo3b5CvH47v0rUYZHTINff1aMKsXBo8uMnFpnw8rFtc1In/n5fP511WjjN1CP9oVleKdLOi+PtesiMIt2zx57o3INa+gDdexexr4zHQ9m+XsfoWBlzUoy7mrdDMpPrzXsfwmtbefwmrTwxSETOMugY449a8iukw/SvZPhAMeEh/12f8ApW2Q64jXscXELawq9Tq5NOstjYtLYcf88l/wr5C1ED+2dRAAAFzIAB25r7If7rfSvji/51nUv+vmT/0KvZzm3IjzeG23Od/ImtslcV5/8UbXydY06+XgTR7M/wC0v/669AtO4rmvija/aPCyTKMvbThvwbIP8hXk5ZW9li4P5HvZtT58PJ9tTPtZRPBbyjo6g19zWOn2bWVuTaW5JjXnyl9B7V8CeFLnzrERseY3z+Br9BbD/jwtv+uafyFfo2PqupSpv+uh8JiHs0R/2bY/8+dt/wB+V/wpf7NsiMGztsenlL/hXL/FfxVdeDvCMmrWEMM8yzRxhJs7cMcE8c14mn7Q/iAuA2l6WBkc/P8A/FVw06FSqrxMYQlJXR9J/wBmWP8Az5W3/flf8K8N/a4s7a3+Hti1vbwxMb9QSkYUkbG9BXLaz+0Z4m0668oaRpDIRlWPmc/+PVwPxN+L2sfEHQ4NM1KwsLeKKYThrffuJAIxySMc1UaM4y1NoUZp3Z5lEefpWxZSDAHrWIvDVoWj4Ax2rqOxmm/FJaz/AGa7SVeBnkDuPSmly3JxUUnrVdbgnyu6OpkALZX7jjev0qFl4qDR5vPsmjJy8J49xVlq00auff5diVicOpPcgYUh6YqQ0xqzaOlo07C7aWMQscyKPkJ7+1TrI0jgZxjqKxFJUgjgjnNa1vKLmMuABMg+YevvXn4ilZcyPlM7yvT6xSWvVGlaT7HAzWjFqPkSq0ZZX9RWAHCgMetPSbc2Qa4Xro9j5VaHqvh3xUSojvOV7Pmu1t547iJZImDIR1FeD205C4zXTeGvEklhOI3YtEexPSvk844cp4hOph9JdjuoYtxfLPY8d8S63c6/qb3V2/y9Ejzwo9qyMZpc0Z4r3IRVOKjBWSPjp1JTlzSd2IaTNBPFMY1SJQE1GzYpSajPJxVpGsI3EiiM0uTnaKl1a5+y24gQ4kcc47CrSBbO1aeTGFGR71rfDXwpJ4n1ptR1JD/Z1u4JBH+sbso9vWunDUHXmkti3OMU5z+FfidR8HvB32WIa5qcZ8+Qf6Mh/hX+8fr2r1SVwoPbijCogVQAFAAA7VSvJsKRX2eHpKjBRR87i8RKvNykUtUnHlSAn+E/yr6R8M7f+Ec0zZjH2aM8f7or5a1GYHIJ4r334Oa4mr+DreEyBrqzPkyrnnA+6fpjj8K4czV4JroehkbSqST6mh8VvO/4V9rX2UMZDD/D1xkbv0zXyRBGZ3RV6evtX25cwpc28sE6B4pFKOp6EEYIr588e/CrUNFjubrw7E99ZsSfLXmWFfTH8Q+nPtWOX4iFNOEtLnVmuFqVXGpBXSPGb8rJcnZ9xeBVrS4C7gqCWJwB71XaJlmKMpVwcFSCDXX+DdOE9/GSMxw/vG+vYV1R96dznl7lNJnX2cCaZpEcfQqm5j796k+ElqzaZqWsTLiXULlih/6ZpwPzrM8bXTwaJKkIJuLhhDGB13Ocf1rvtJsU0jQLKwTgW8Kp+P8A+uvhPELHcmGp4SL1k7v0R6/DWHc6k676FzR7f7dr1tGV3Jv3MPYV6p0X8K4T4fWpkvrq6I4QbF+p613U0ixRPI5wqAsSfQc1ycLYf2WD9o95M9vHz5qvL2PEfE+tv/wvaxZGLQ6eqQFR0y4O7/0IflXuAwRXyzpt0+p+KNV1TcWaW5d0b2BOP0Ar6Z0a6F5pVrcKf9ZGD+ld2XYz2terDtqPFUeSEH5HgX7QmkC08Y2OpRxnZeQbXbHG9DgD8q5XwwN1/GPrXtfx60r7d4MF0ikvYzLN/wABPDfpXivhHnUM+iGvKzuHLVb8j6nJKvtMMl20OgvF5zXr3wjGPCQ/67P/AEryW661638Jf+RUH/XZ/wClYcP/AO8/IOIdcKvU7N/ut9K+Nrw/8TrUv+vmT/0KvsmT7jfQ18aXLZ1zUx/09Sf+hV7ec/AjzuGf4k/kWrYYaodes/t+h6han/lpCxX6r839KlhbDCranDqDwrcH6d6+bhJwmpI+srQU4OLPEvBtz5epCFuPMyvPr/kV+j9gP9Atv+ua/wAhX5sXsTaX4onhHBhuDj6Zr9JtOOdPtj6xJ/IV+hKt7SlFH5tiVy+6+h5r+0eM/DWb/r6g/wDQjXyUy7Tn8q+wPj1YXWpeAZYLG2muZjcwkRwoXY4J7CvmCfwd4kPK+H9XP/bnJ/hXrYCUVS1fUdFpR3Oe1yH7boyTqMyQHB+lcvGwKkV6dYeEfEZEkMvh/Vgkikc2kn+FcBr+iajoN8YNUsbmzdstGs8TIWX1GRzSrcvNdHVGSelzMYHdVm2ODUHWpEOKyuUaUb5GKUnNVY36VODxTRLLGm3P2W9R/wCBvlYe1dBKNrEA5XqD6iuVcZrodOn+0WC55ki+U/T1ppnuZHivZ1fZyekiWkIpW6cUhps+vY3pToZGikV0OCKQ9KQ9KlpPRmcopppmkSJEWSPlW6j0NJDuEo5yKp2lwYXOeUbhhV1VEMwfO5WGRXl16XI7rY+GzfLXhp88F7rNNCT93rViN0THPzVRWUoMg9aT/lpuPQ1ynjHnVFITSE1xHzNhWNRk0E00ZY4FUkXFA3SrFlCXcEjIqNI/MfavQdatXPmIsVpaRtJd3DBI0UZPNUk5PljuzT+6h2naXc+Ktfh0qy4hQ7ppB0Re5/wr6G0jT7XStMgsrKMJBCgVQO/uawvAHhmLwzpCxsFe8l+aeT1PoPYV0zPxX1+X4RYeCb3PHx2JVRqEfhX4kUr7RWPfTDBq7dyAKea52/m5IBr0XojzFdsoXchYnNXvCHiy98J6yl5ZYeM/JNCThZV9/cdj/iayJ5OtU442llAA5NR7NTVpbGvtXSalF6o+uvCHjHSPFNmsumzjzgB5lu/EiH3Hce4rph0r4wNzJZvGtpM8UkRyJY2KkN7Ed69E8HfGDVNNZINeX+0LPOPNHEyfj0b8a8TEYH2bvA+mwWYutH96rM9h8XeBNC8TDff2aR3eDtuoQEkB9z/F+Oa80ufBVx4RSQF/tFvI3yzquMegYdq9k0DWbHXtOjvNMuEnt37jqD6Edj7VZ1C0hvbWS3uEDxSDawrGhiJUJWex04jCwxEbrc+bo4Bq3jrS7Mrvt7QG8mHoRwufxIP4V6BqEnvmsrRPDdxofiLxDcXoIeWYQwHPWFRwfx3foauyK1xcxwpyzsFA9c1+VcVYx5hmslDVR0R7uS4b6rhUpbvVnoPgi1+zaFC5HzzEyH3z0/SoPiVqf9keB9XuwwEggKJnuzcD+ZrorWJbe2iijGFRQoHpgV5R+0PqITQNP0xT891cCQj/AGU//XX3cYLCYNQXRHPBe1rerPNfCEHk6emO9e9fDW6M/h1YnILQOU/DqP614tpMYjs416YAr0n4VXW2/vLQt99BIB9Dj+tfI5PXccw163R62OgnR9Du/EWnR6vod/YS8JcQtGfbIr5i8KwvDqVxHIMSRhlYehBwa+re9fPviDTf7M+Ietxqu2KT9+voQ/Jx+Jr3s/pXoqojXh2tacqT66lO6+9Xrnwm/wCRVH/XZ/6V5LcDnmvW/hR/yKo/67P/AErysg/3n5Hp8Qf7qvU7GT7jfQ18YXB/4nuqf9fUn/oVfZ8n3G+hr4tuDjXtV/6+pP517ucK9NHncNfxJ/IuIeauYyoqgh5q9GcpXy8lZn2TPKPibZ/ZvFsc6/dulWTPv0P8hX6FaZ/yDbT/AK5J/wCgivhb4q2nmafp12oyYZvLJ9m5/pX3Tpn/ACDbT/rkn/oIr7HLantMNB/I/Pc4pezxUl0epapK4D426nfaT4GlutMu5rS4FxEokiOGwTyK+dpPHniwDjxDqQ/7af8A1q93D4GdeHPFnnQpOauj7J9q+Tv2xIj/AMJVocnO37I4/wDHxXM3HxC8XgceJNTH0l/+tWBr+pap4rtm/tnULi+uYR+6eZskDuBWqwU6T5mzelScJXZwa9BUimo2jaNip7cUUHWWYmFWYzx1rPRiKtRtk0JiaLB6Va0m4+y3g3H92/yuKpk+lISeue9WOMnGSkt0dVIuxiucgdD60wio7CYXNkrE/PH8rfTtUxpn3+DrrEUVMbim4p9IRQdNhhFXLGbH7mT7jdCexqrijFZzgpKzMK9CNeDpy6mmkjCUhhz0q1kZ5wcVQtpTMmxj+8XofUUokIycYPcV5NWm4PU/Psdgp4So4P5HCk00mlJpnJOBXnI+PSAcnA6mpguwbV5Y9TSKPLX1Y9KmgTn1NDY27EsIW3hMjkBV616P8L/DBj/4n+poftEo/wBGjb/lmnYn3P8AKsHwN4bOu6gJ7pcaZatls9JX7L9B3r2PgDAG0AYAHavoMowF/wB9UXocOLxHs48kXq9xTjAxUE8m1ac74FULqXAPNfRpHjMp30/B5rAuZNzHmrl9NuJrHuJDzzWb1djRLljchmbc2BVu3H2a381sGRuEBqtbR+ZLlvuDkmvUfB3wwuPE+hXGo3kzWZkXbZIV4OP4nHoe2PrSq1o0Y3kx4bDTxM7RVzzJE3ZJ5qYQjaGYDBOK3NX8L6roN0YNUs5IsHAk2kow9Q3SqM8e5ooY+WY4AzXKpc/vXPTUXTlytbHp3wCeeDUrpNzC3nQnYTxlf4sfpXuh5615x8KPDkunRLdTxtGix7Iw3BbPU16PnjivJxbj7T3T28ApKl7/AHOK8bELfoR1ZB/OsbwhAbzxFESPkhBkb+Q/WrPje6D6q6qQQiBfx71o/De1HlXd2erMI1+g6/rX5fRw6xWdyttzX+4+llJ08LfrY7XtxVG+0qw1CRHv7K2uXj+40sQcr9CRV44A9q8U1f4n6xH4lvrWxW1+xwzNEhaPLNtODzn1r7vF4qlh4J1dmebRozqytA9bGiaWowNOtAPaJf8ACpbfTbK2k8y3tIIn6BkQA/pXlkXxB1lkBItcn0jP+NSJ8QdVV1aZbbywctiMg47968mOd4BSXKtfQ6Hgq6Wr/E9aHavNvilpwW+tNRVR8yGFuPfI/nXotvKstvHIhBV1DAjpg1g+O7P7Z4ducfeixKPwr0cxp+3ws1HsGXVvY4mMn3seKzjn869a+FP/ACKw/wCuz/0ryW4HWvW/hV/yK4/67N/SvmeH/wDeX6H1PEP+6r1Owf7p+hr4ovWx4g1Qf9PUn/oRr7Wl+4cda+RdS8G+JG1/UJF0PUDG9xIysIuCM8EV9FmsHKCSPJ4fqRp1JczsZ0Z4q9bHIq4nhHxCAAdEv/8Av1/9erCeGddhRnm0i9RFG5maPgDua+aqUKn8rPr1iaTt7y+85jxda/a/Dd7GRkhRKv1U5/kDX2Rpf/IMs/8Arkn/AKCK+UDGsv7t8FZBtb6GvrKxAWytwOgjUfoK9rI6l4Sh2PleJKaVSE+553+0H/yTuT/r6h/9CNfMLrla+o/jza3F54BkitIJZ5ftMJCRoWOMnnAr50Tw7rJUf8Sm/wD/AAHf/Cv0PKpxVBpvqeJRa5TmLiP2qK1fyLlW7Hg1003hnWmGBpGof+A7/wCFZWpaBq9lC89zpl7FCgyZHgZVH1JFb1HF9TZNHNa/ZiG9ZlHyv8wrJMQNdPqaG60sSAZaLg/SufjHHNeXUjyuxqtUU2jI6UsRwcGrbpVdk2vmsgJkbIxSnpTEGORUlWhMu6Jci3u9rn93J8rVvyLtJHpXINkPkHmupsLj7VZRyfxL8jVSPoMhxXJUdGWz29RxFL2pxFNwaZ9ZYQ07YSOKQ5p6PjikyWRruRgRkEelWyRPGZFX94PvKO/vULEE8UxWeKQOuc9/euetT9pE8/H4GGMp8kt1scaafGMDc3TtSxpk5PQUSHceBgDtXzlz8XuCBmfc34VveHNHuNZ1KO1tht/ikk/uL3NZun20t1cRwQIXlkIVVHcmvcPCuhR6DpohGGuHwZX9T6Z9BXoZdg3ial3sjlxFdU15mlptjBpljDaWiBIY1wAOp9z71MzYoLZ5JqGRq+wjFRVlseLJuTbY2Z+tY19NgnBq7dS4U1hXkuSaJOyCMbsp3EhJJrNdt0lWblyARRZxY3zSD5F6D1NJKyuE3zPlRo+HJdNtdbs01tZHsRIHuBH1x6H29cc19b6PeWN9p0E+lzQzWZXEbREFcent9K+Lm3M7M3JNdD4V1zVNBuTLpV5LBk/Oo5V/qOh/KvLxcHXloz38DOOGhZo+upoY5lKTIrof4XAIqjHoelxz+cmnWglHIcRLmvJNL+MF9FEq6lpsFw/9+JzGfy5/nXXQ/EeKSBJG02ZWYZ2mQcVxfVaydkj0XjcO9WzvwABgcVla9q0enWzfMDMwwq/1rzDxv8TNRtdFuptPiitXVCFc/O2TwMcY/nUGhpdW/h6zXUbiW5vWjEk0szFnZ2GTkn0zivmuJsdVyugor457eR35a4Yyb5doj7+dpZWdzliSSa9S8LWgstDtItuGKBm+p615OxzIGwDg5AIzXRL4u1REwrQYUcfu+3518dkOYYfAVJVK97s9rFUJ1YqMOh3fiLUF0zQ769bkQws+Pwr5gsVZroyScuzZY+prqvEvjjWtWtrjT7mSAWrnDbI8Ej061hafDzmvVzfMYYpL2e1isHhpUU3Lc1ouEFNn/wBTJnptIx7VKq/KKjuf+PeX/cb+VfN0376O09R+B+sf218NNHmZy8sCNayMTyWjO2u4uY1nt5ImAKupU+9fGfwy+IeveFbKfT9KktxbSTNKRLFvIbPbkda9g8M/EnxBqVlLLcvakhto2Q49/Wv0apmNCjDlnfY87+x8RUlz07W9TO1K2NrdTwMeYnZPyOK9S+FmB4YA7+c39K8y1W6kvrmS5mC+bIckIMCp9L8W6nolp9msWgEQYsN8eTk18xl2MpYbEupK9mfRZhg62Mw0acbXVj3YgE80fjXhl78TPEMcDtG9puA4/c//AF65eP4zeLWcK0lh6f8AHv8A/ZV9PTzjD1LtX+4+ffD2LXb7z6bNZ3iHjQNS/wCvaT/0A14Inxa8UEf6yy/8B/8A7Kku/ij4kvLWW3mez8uVCjYgwcEYPf3qamb4dxa1+4uHD2LUk3b7zlFJzGR7V9ZWX/HpB/1zX+VfJSnCAjqKu+OvjX4z0CzsZdOlsBE2Y2D227kDj+L0rz8lrRhNwluz0+IMNOrTjUjtG9/nY+rjzwaAPevjDQ/2i/G91qEMV3Lpnlsdp22mOv8AwKuwh+NPi4ttaSwz/wBe3/2VfZ4bA1MQr0z5JUpNH1B+NcJ8bxn4Ya5gn/Vr/wChCvIf+FyeLcZ8yw/8B/8A69Y/ij4neI9f0a502/ezNtOArhIMHrnrurqjldeElJ2KjRkmeZ2bAF4m+64xzWBNGYLiRD/Ca3ZFKMCBgiqOtxBmjuU6OMN9a6cTDqd0NNCgcEVDIuc1KAcUxhXEURD0qT+EUzGDTxxxTRLGN1rQ0O5EN2I3P7uX5T7GqDjFREkHIOD61RVOo6c1NdDtJEMbsrdR1plS6dJ/aelJOvNxCNkoHf0NRZyatM/Q8LXWIpRqLqJQOtLSGhm7JFWpcZXBFQxk1Pg4rKSMZXOMAz8q9KUpjgdamChF6cmuy+Hvhr+0br+0LxM2kTfID/y0b/CvnMPQliKihHqfgc6iiuZnRfDrw2NPtV1C8TF1KP3an/lmp7/U12rNjpSE1G7Yr7fDYeOHpqETxa1V1JXYO2BVaZ8A06Rqo3UuMit2yEVL2brWPcSZq1dSZJrMnftWS95mztCN2RqjTzBV7mrtxhIlij+4gx9T60WcfkwGUj524FMl6fXrU1ZWVkXhKTlLnZVUc49604ECL05qlAm6TPpWilc0F1O+euho6PbfabxAfur8xrsuAuMcDisfw5beTaGYj5pD37AVqO2FP0rqgtLnHUlukYup251bxBo+ljmNpftEw/6Zpz/Ou+u33cCuR8DRi81rV9VbkRYtIT2wOWI/E4/CuqcAkntX4jxlj/rWZSgnpDQ+/wAhw3scKpdZakAXBok+WNj0wDUnFQXjYtpT/smvl4u7PbscFIN9w59zWvZRYQVlwqXmPua37ZMKPpXs15aWNB+3C1Wu+LWf2Q/yq43SqWoHFlck9BG38q56Pxr1Ezw3w+czP9T/ADr2LwIn/Epl/wCun9K8b8On53P1/nXtHgMf8SVz6ua+pzRHr4b4EzZmBxWdc960Zqzrgda8F7no0zPuRmNh6iuF27bph6MRXeTDIIrirtNmoyAf3s16GEe6HNbF1BxUi0xOlPTrWkty2i0n3K5b4lW32jwnM+CWglWQewPBrq4+UzWfr1v9r0TULbr5kLAfXHFaYWfs60JeZyYymqtCcH1R4LbSGKVHU8qQf1r1a0mE8MNwvSRckehryRflcg9jXovgu58/SWhY5aJ/0NfqeT1eWo4dz4Gns0dXCA6j1qG5jxmm27kY5qy/zJX0co6GhgXUWDmq8sYltJIsZYfMtad4mVJrNyUcGvOrwvoCepiR43EGpGiB5o1KM2986DhW+YVJDyleNJWdjVFSSPHIpMd6uSqO1QBCKExMgdcioWXBq6U4qu61SJsanhO+NlqarIf3MvyMO1dNq9l9nl3x8xMfyrgAxVsg4I6GvTNEuE1bRE38sBtb2PrWkdT6Xh/FWk6EuuxhdqQ1PdQNbTNG/Y8GoD1pH1LVhVJB4qwpOBmq3Spo2ytKWpnIo+GtEl1vUlgT5YV+aWTH3R/9evaLWGKytora2TZFEu1VHYf4+9UvDejxaHpi20RBc/M745LVebvW2W4FYWneS95n814mv7R8q2FZ8VG7ZFNc1E716b0OVISZwBWRdy8mrVzNWVdPkmsZs3hEqXEnpUNvF502D0HJokJZsDrVyJPJgCD7zck0JqCuJxdWfKgkJZvQDgCoZFyKmxSom41yyfMz04R5I2QyCPavvV2wgNxcxwj+I81XIx0ro/C1qNj3LryflWqiuhMnZXN5ECIEXhQKo63dCy0y4nPGxCR9av8AasHV4v7U1jStJGWSecPMB/zzXk/nSx2JWDw860toq5jQpOtVjTXVnW+ELBtN8LWFvKP3zp50p9Xf5j+prQc1amPJNUpDzX85VarrVJVJfabZ+qU4KEFFdAzVPVH22Mx/2as5rP1tsafN7jFOkrzRZy2nrulzW/EuFFZWlx5Ga2AOK9GvK8ixr9Ky9cfZo1+/TELn/wAdrSkPFYXjCXyvC2qP/wBMGA/HijDR5qsV5oGeN+GjkMe1e3eBRjw/n/bNeI+G/wDV8V7j4JGPDsfuzfzr6jNNz1sN/DRpyjis+46mtKQcGs+4HJrwmejAzZuhrlNUjK6gSO9dbL3Fc7q8Z81HFdOGdmaNXRAtPT71NFKh5rpY2XYv9XRgbxnp0NEJ/d/jQTz9DUJ2dyWr6Hz3r1qbLW723/55TMv4A1veBLvytS8gniYFPx7UnxNtfs/iydsYWZVk/Mc/rWBpdw1tdRTKcFGDV+g5dXt7Op6H51Wi6VeUfM9cAKk8VMj8Y7UzInhjmT7rqGpCCK+9i+ZXGNuBlTWZKmDnFavVearTIAc4rlqxAw9bhMlqky/ej4P0rMs5OcE10bR7leNujg5rlcG3uXjb+E14mIp2dzRGnnNMZCe1ELBgKnArnKKwXHWoZEq9tpkkfHAq0xNGTIhB46ZroPA+om01EW8p/cznHPY1kyRnmqpLxOGXqDkH0qk7MuhVlRqKa6Hq2r2Pnw5H+sXofWuXYFWIIwa6nw/frqekxSj/AFgG1h7+tUdb0/KmeFeR98VrJX1R+i0ayr0lUj1MKlU4NJRWZR7TJ0FQN0NFFe09j+X+pBJUEtFFTIpGbc9KzJ+poorCW50Q2KsX+vT61fn/ANb+FFFKp8I8N8bGVJD3+tFFc8dzvlsI3euz8P8A/ILh/GiitYfEZVPgLx6Vl6F/yUW2/wCvOWiivK4m/wCRXW9P1Nsq/wB8p+p3c33apv1oor+f4bH6Yhves3Xv+QfJ+H86KK6KPxoZk6X/AKutHtRRXZV+Isik6Vznjr/kT9T/AOuR/mKKK3wX8eHqvzE9jyHw3/q6908E/wDIuQ/7zfzNFFfSZpuevhv4aNWXoazbjvRRXhs9GmZ8nU1i6p91PrRRW1D4jUonrQvWiiuxgXYP9XQ1FFZknlHxe/5D1r/17iuJh6n6UUV9tl38CB+f5h/vc/U9m0f/AJAdl/1zFSN0oor9Fo/AvQzGdqjm+6fpRRUVQKTf6wVymq/8hWT60UV4+JLRPa9KuL0oorgLQopW+7RRVIGVJO9Upehooq0RI7j4df8AHhc/7wrpbj/j2n/3DRRWy+E++yj/AHSJxR+8aKKKzO0//9k=" },
  { id: "brand",   label: "ブランドストーリー",   desc: "シネマティックな企業紹介",          category: "製品紹介", popular: false, platforms: ["shorts","ec"],             thumb: "data:image/jpeg;base64,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" },
  { id: "review",  label: "カスタマーレビュー",   desc: "ユーザーの声と実績紹介",            category: "製品紹介", popular: false, platforms: ["ec","reels"],              thumb: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCADhAZADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCeLw/o3mxg6Pp2N4/5dY+cnkEYr2oeB/CeB/xS+g/jp8P/AMTXlMP+uj/3h/OveB0FAHPf8IP4T/6FbQf/AAXQ/wDxNL/wg/hP/oVtB/8ABdD/APE10P8AnNeS/Gf4qjwgp0vRRFJrLLueSUZS2U9CR3Y9h270m0lqNRb0R2z+CfCEabpPDPh9F6bnsIFH5laUeCPCRBK+F9AOOuNPhOP/AB2vkXVNM8e+MJft+pvqVyshzm5kKKR7J0H5VGT4u8FTpeWt/ewOnPmRzsy/8CU8GsfrEL2ubrDTtex9fjwR4T/6FfQf/BdD/wDE0v8Awg/hP/oVtB/8F0P/AMTXG/BD4oR+OtOks9SEUOu2q7pFX5VmT++o7Y6EduPWvU/rWydzFnPDwP4Tz/yK2g/+C6H/AOJrxnUfDuirqFyq6PpqqJGAAtY8AZ7YHFfQ9eGan/yErr/rq386YjE/sDRv+gRp3/gKn+FRXGjaFbQyTT6ZpkcKDcztbIAv1OK1+9YHijQ9Q8VAaHpc0cLlPPmeTIGAflX8T/KlOSirsqMHN2SOOu/EegPctHpmg6a8akgSzWyDcfZcdPqRWO/iSOGf97oOgTJ3ijtVBx9ea6K6+EninS7IyeRb3GDn/R5NzH8CK4yfSJ9PvCLyKSAqDlJUwD68GuZVlLZnQ6Elujs/Cet+HNbuWtrvRNLs7on9yphQiT2ztHNdmPD+jf8AQI0//wABU/wr53m/cTlomZSjblPcV9GaDPLdaLYzz4EssKO31Izmt4u5zyjZkf8Awj+jf9AjTv8AwFT/AAr1nw94L8LS6FYSS+GtDd2hBZm0+Ikn3O3mvOa9l8M/8i9p3/XBf61ZJR/4Qfwn/wBCvoX/AILof/iaB4H8J5/5FfQv/BdD/wDE10J96+dPjN8ZriO+uvDvhdJEMTFLm9D7S2MgqmOgz39uKTdhpXPVtU0n4daSxGq6b4TsyMAie0gTBPT+Gs2wl+E+o3v2Oxi8HT3ON2xLWDJHt8tfHqPcXtxta4nup5CPlZyzM3rk59BWtP4R1xYxcixkTncAGGQfUCs3VinZs0jSlJXSufaI8E+EmAI8MaCQecjT4f8A4ml/4Qfwn/0K+hf+C6H/AOJr5l8A/GDxB4NIsdYVtT00cCGU7ZofXY3p/sn8K+qNB1vT9d0u11DS7hJra6TzI+QGx6Fc5BHcdqtO5Ljbco/8IP4T/wChX0L8dOh/+JrHvfBvhhbqQL4b0QLnjFhF6f7tdzWJff8AH3L9f6UyTmv+EO8M/wDQuaL/AOAMX/xNJ/wh/hgf8y5ov/gDF/8AE1vVz/j3xEnhTwpfau0YmeEBY49wG92OFHPvQFhl34Y8I2kBmu9D0C3hHV5LOFQPxIqlp+meAtRkMdhYeF7mQHG2K3gJz9MV8oeI/EmteKr17jWbua6Y/diGfLQZ6Kg4AFQW2h6o0X2q2sLsKpyJY42XBxjgjkcVPOkUoM+yP+EO8M/9C5ouf+vGL/4ml/4Q7wz/ANC7ov8A4Axf/E14v8GPiJq8GuW3h3xNLLNb3GI7eecnfG/8KZ7g9Oec4r6FNNO+ommtzC/4Q7wz/wBC7ov/AIAxf/E1G3g/wzk/8U7o3/gDF/8AE10FMbrTEYH/AAh/hn/oXdG/8AYv/iaUeD/DRxjw7o2T0xYxc/8AjtbmCSAOpOK+a/ix8U9UvdWvtJ0adrHTIJDEZITtluCOrFv4V9h6UAe8Hwf4aHXw7o3/AIAxf/E0n/CIeGf+hd0X/wAAYv8A4mvmfS/id41XTYtI0zUJZX3fJK0YkuMf3Q3oPpXUaKvxZvJS8mo6tEjg4aR04PbIx0qXNLcpQlLY9w/4Q/wz/wBC7o3/AIAxf/E0o8H+Gv8AoXdG/wDAGL/4mvnfxT4t+JmjWn2HWL28tgWz9oCKHf8A2fMA6H0rvPgp8SbzVr9PD3iCY3N26FrW6bG6TAyUf1OMkH25pqSewSTWjPTf+EP8M/8AQu6N/wCAMX/xNaem+C/Cz2+W8NaGx3dTYRH/ANlqyORWvpX/AB7/APAqZJlf8IT4U/6FjQv/AAXxf/E0f8IR4U/6FjQv/BfD/wDE10NUNc1O30XSLvU71ittaxmRyBk/Qe5JAH1o0tdhbWyMt/BfhJEZ38NaCqqMktYQgAe528VhzRfC+BsTQeD02nBzbwcH0+7XCXkfiD4hyF9U1I6bpTNuisIeir23f3m9c1zmvfCy50y1c2OuFoSuDHLFtHrjiueWIitDqjhKj1se6WHhbwTqNstxp+heG7qA/wDLSGygdfzC1YPgjwoD/wAixoX/AIL4v/ia+PrS48ReDNRa70a+ktZUJBeB/kf1DIeCK+tfhb4sPjXwZZ6xJCILhiYp41+6JF6lfY8H2zitKdRTWhjUpOnuXP8AhCfCn/QsaH/4L4f/AImuZ8VeEfDcFzbiHw/o0alCSEsYh39lr0fvXKeMf+Pq2/65n+daGZ51D/ro/wDeH8694HQV4PD/AK6P/eH8694HQUySlrmow6Ro97qN0N0NrC0rLnG7AyFz2yePxr5L8EGfxV4y1LxFqSwS+XIbkm5l2xiVj8uTg9FHAx1Fe7/tEX7WXwvvo43Kvdyx26468ncf/Qa4L4BWdmfA00l1FCVnnlLl0DZAwBkH0rixlTljY7sFT5pXO00u7h1K1meQW3lxZ3S284lQn64B/SuI8bpO0UhXSGe2ZTh5JowWHsuc11+r2dvbaFfpp9sLYSRMwEUQQMT7LWG2j6VqGi/2nd2UMt9GnllnGWGOK8pNJ3R7NpWseCeEtXm8F+O7PU7STatvMrkHvETh1Yf7pP5Cvu61miubeKe3IaGVFeMj+6wyP0Nfn94jC/25dKqgKDt/CvsD4A662u/DHS2lO6ez3WchJ5OzofyYflXt0ZXSPArRtJno1eGap/yErv8A66t/Ovc68M1P/kJXf/XVv51uYFatHQ7+LSbmW4lsry4adVGYI8hVXPJJwB1rOro9JsdL1PRNutpE0UUu2MOM/Nj0PBPJ6iufFfAdWE/iHTaJ4i0vWrNprOZ9qHDLKpUr7/T6V5742vNA1r7RFb219fyQZEj21vkIfqxH6V0yxeH/AA7o+oG0ms7ZRHiTLKCAenAxWPpPhzwvrekFCIZlWViHi2/M394MRnkd689tbNHppNLRnz94l0O13/arJpPLY7AjqQQTxyDXsOkqsel2cakERwRx5B4O1QP6Vzvi20sY9cS10wHYh2xgsWxjjknk10el2y2ljHEoKgZOD7kn+tdmGm3ozgxdOK95PctV7L4Y/wCRf03sPIX+teNV7L4Z/wCRf07/AK4L/Wuw4Tzb9obxwPDvhV9MsZNmpXxVRhhlY/4zjvnpXyNNJlDKZMszbm5znPXNepftE6pLqnxKuYHKPHYRLFEUHRT8xBHrnqa8qkRTLGRnlgMtgd6yZpE9V+HlnpmmeRfXYT7XMNxdlJCD0HpxXpmu6vpyacpSSJdwAXaCxJrlND0K2NoLn+05YLcIN0Kv94AdAMHjvV24udEQWBa7iPZfLfLg5/z+teNUknK7PepwcYWtY838cQ29zELhUdJlcZ3oUz+BpPhH4rm8J+N9PnWbFhLIYriIsACrcZ/CtbxtpWnWumTGC9N1JLzvduVx9a8ykGECsuB1LA5r0MLJcujPLxcXz6o/RKORJY1kjZWjZQVZehGODWPff8fcv1/pXE/s9eKINd8CWti1y8upacgS4SReQpJ2H3G0AfgfSu1vv+PuX/e/oK7EcVrEH/6q8n/aP8xvB2nxKD5T3oMnHouVz+NesV5d+0Bpkl14Wtr2OR1jtJx5keflYONoJHTg81NR2iy6avJI8X8PwFpo0iEQbg43DNehJeSRaY8dxJbW6kECSWTaPpXAQ+HZbfTVuriUBH/1RjwG3dvrXWy6It74ZsZLq4mgYghnRgWYj26mvHnK0k7nvU43g1YwXgE+qWcttPFJLFcRyRychQwYYOT2r6lUkqpPOQCSPpXzY+i6faQW1y2rC9jlYCQ5xtHfPTB/CvpNAFiQL90KuPpgV34STd0ebjY2aYtNfrTqa/Wuw4BuSDkcHr+VfKPx38N6f4b8XRrpcbxQ3sTXLITkK5bkKT2r6tNeKftH6O11/YWoqpxEXt3KjnBIYZPpxipk7K5UVzOxzXwm0+LTbZbm4RUvJzvGVJfb9K958P3drPbmYyIyIPmP931zXnPgvRLbVLWF0vLmzlTGfJcKD7HNdXoDWf8AwkOoRR3Ylt/J2M7SDOQcEgdvT8K85y5pXZ7KhyxUUWfHlnp/ifw1fWUW2WV4yId6EfOORtJH8q8h/Z58IQXer3HiC6uJBc6XMYYoFXA3MrKWY9TxkY9a9t0jRbW1aWRNQuZwjH5JJMhTn0xWP8NdCi0W21OaIj/iYXHnFQDxgsPx610UJXdjjxcLLmOzHStfSv8Aj3/4FWRWtpX/AB7/APAq6zgLtc98QraK78F6pFOoaMxqzBjgHa6n+ldCazPE8ay+HdSR13J5Dtt+gz/Son8LKhrJHk+natbafCskl7bwtkL5Jj56cAHPpU3i/XoFsorbyds1yR5TTA7frwcn86j0nUbCZFX7IjPDGrOzNl2J/uqTg+nNZHjfxZpyS2zWlpeSXEaEASRhQpzxk54FePZ9D6J26s8x8Vun2t4luIbkqpD+Um0AjqOpr6K+AFpDafCjRRA6O0oklkKsDhi7cH3wBXgPi3VbK6hDxQwrMfvmNt36nmvo74O6XNpPw40a3uo/KmaIylDyQGJIz9QQfxruwmh5ONtfc7Qda5Pxj/x823/XM/zrrB1rk/GP/Hzbf9cz/Ou04TzuH/XR/wC8P517yOgrwaLiWMn++P517uWCgZIFMk8C/av1MxWuhaejfe82d1+m0Kf1Ncb+z54jjl+2+Gr923ufPtfTGPnH16EfSu++NHw813xx41tLnT2tItMgs0hMs787tzFsKAT6Vv8Awz+D8HhTTrt7i5iudVndSkyrhY1X+EZ5we9cWIpuomvuO2hU9m4v7xbixNtp8kZSC4GCI98Kk/8AAj1J+tcSt3Bo2lapPeskW/lghwiKP7o7Zr1fUvD2pNGwiTJxxtYbc/T0rl4fhjNqF8s3iWdHtEbcLRTkP/vY7V58aVSTUWrI9V4inGLaZ8kX16brUJ7kpjznZtp6gYwAa9p/ZS8Si08UXmhSs3l6lEHjBPSWMHj8VLfkK7PxF8AtG1i/lurC5uNO3tuKIoZcnrgdhV3Q/gHoWiXdnqFpqmrrqVrKs0cqyIF3DnG0LnB6EbulerHTY8aet7ntHavDNT/5CV3/ANdW/nXtdtcCdmjPEq/eB7/T2rxXVP8AkJXf/XZv51unc52rFU1ZsXhkmhtLxpI4HfKyoceW+MDJ6DJ7/h3qselTR2Fze21w9rbmYRxs+exIBIGfXIpVIKa5S6VR05KSOgutA0f+zVg1tI7i4UHLSrGCx65AI47flXEz6da6TeNqRu5ba1jwIoE2DvyTtAzx0rduNa1NdHtbs6Ymp5hEsMsZUMhxyCp9MdRmvN9cm1/xlqEVoLTyEQ8hF/Mn3rztZPlR7DnaN7FjQLtdW8VT3QACESsATkZJzgfSuyFR6X4FOh2sAVzLqD4TK/dQH/PWt5/Dl35HmR7H9Vzgj/ODXpUqDhE8WtiI1Kj1MUcmvX9Ina18H206QtO0VpvESHBfAPArym4srm1YCeCSPnHK8fnXqWnrA3gm3W8Ki3azw+5to285yaqSsJNPY+LvGsMNj4r1u3iw0cNw8CMG3g7TgYbqR9efUmudUPsZhtHHUDpW74wvW1DxHfzrjHmlAjYwijgKMcYHSsZUlLtjBI4woyegzxWDND0vwJf2+qWRgV2jvkUBTwTkdRzxzXX6yscmlrFbabfJdbcF9qqB6ncK8g8M6a5eZ4pWjlGGVo8gqfT37fnWzqGpeIGh8l7+RlIxyO1ebKCU2onrUqrdNNog8eXlnGyaZAwdgAsspPLHuTXGMsgVAwTZnII5OPSrV1beVdgXJJZuSxHSoXURKY93Q4xjmu6lDliefXk5T1PUf2ePEkWjeNore5m2W9yTEW7Hd/XIHH/16+otQBF7KGGCDjFfCmkX0mmaxZ30G4PbTrIuzHUHtnj8/wBOtfcVvcjUoo7qEEiZFkxjHJUE1ujBoWue8f6E/iTwhqWmQEC5lj3QFunmLyufxrrY9PmcZbCL+tZPiCzvTbslnMYmIxuHUU2tBK/Q+PWkuJGOn3okjmtGaOe3kbDIAcHHpznmvQ9A0TS7fSklW3l8xuRcvcwgIfRBhifpxnmuU+KOl6hpXjq6uL1ZFmdxJHNIMrKPUHofQ/SqVl4lurW7M1no1mly6kAiEsQT3HNcc6XZaHo0ayt7+pp+GtIk1/x9HotkzSQ/ajLcyMvAhUgtwOBnp9SK+rsAYA4AGAPavGf2cfDF/H4gm1W8jYrOjedxxg9Bn/ewce1e/wB1pSE5t32j+6ea6KUUlocddtyuzGpj9TVueznh+8hI9RzVR+prUxYyqmq6dbarYy2l6m+KQYPtz1q5VLUtSttPhZ5nLN0WNeWY+nt9aTt1BXuee2OnRaXc32lPLJHIqkQzKcH1U+nI9a1fBunSwxyPcpLJOMgS+Wgz6E/L/wDWrGu9MvNU1O4v45VEk7ZaGQkhfQK2M4Fdt4Ys9VijWNnhVcYLMd3/ANc15/I1JpHrwrx5feZJZaXLBcPLd3JmncAN8gRe5HA9AcZ74rYRQiBUACjoBx+la9ppaCCQys0kr8lz2+ntVSWwmj4GG+ldVGHKrs4cTWdR2WxVzWtpX/Hv/wACrJZGjb51K/UVraXxb/8AAq3OZF2o7iFLm3lgmUtFKpRxnGVIwR7dafVe+hmuLaaKCQwu6MqSjgqxBAI+mc0NaMa30PDZdEt9C8ZPpd+0F1NGoltZGA3bTyuR0zjirXjrxBZz6VLbDSrv7QAB80SBM4xy4ryDVI76z8QXf22SeS5SU+Y0jHeSD69aj1j+0ruIMl9cTQHjDv09q89xXNY9SNRqNmrholrDrfjPR9IIEFtNcpC5j6nJyT+mK+0YY44YkihUJFGoRAOgUcAfgK+GLC2nsLhJ4JXjuo23LJGcMjeoINfWnwmudZvfBlpea3dSXVxOzOskoG4p0HQexrppSV7I4a0X8TO2rkvGP/H1bf8AXM/zrrMkHJGK5Txj/wAfVt/1zP8AOtznOPj02MtHtk2MGB57817SEGwZCnIqs0MRBBijwR/dFMyfU/nQ1ccXYkaNUkGRlScEVah+UDuKoZ9zS5OOpx9anlK5rmhIM9GIqFoEZvmya5m98V6VaSFHuTIR1MXzgfiKq2/jjQ5pdou2UA4LFTgfWpsh6naRoqjAFRP8wPpVOKVJo0khlEkb8q6NkH8aUE56mq5Rcxk6pM1leQXSkgKwV/dT1rin8M3VzqF20siwqXZhxuJ5716UyhhhlUg9QRmuflJ8x/Xcc+/vVQXLuTNuWxgWXhW2jmX7RLLOTjCAbR+PtXRzy2ejWAkmkhtLWMgb2O1R7e5qHJzkcHGKRgGGGAYH15HtWvtEtkY8j6mHolhDdTXy2SyvphmzC4jKqpYZZV/2c9D3ya3oNJt9LRhFAqOBluOc1g6v4y0DRZWg1LWrS3mHWLzNzj6qMn9KuaNruma7AZdJ1G3vQPveW4JU/wC0Oo/GuanThCpzHVUqzqU1C+xqQQrLqDSBRshOFHbf3J/lipUj8iN1K/IrE7T0Kk8j8zmqwOBheB14/nRkkYJNdXtTk9hZFiOxWK3+zyEyKGIUsc7gef8AP0rI+IEU974PGkaSqBpwgkJDARx55Ixznvj0rSLHg5yR+lee6xLIurXgEjgCUjhqiUuYuMeU+ZdTWNbucxbPswkKxgDaMDoMdq6X4c+Godd1QpcyGK3SRDKVXJCknp684r2EwQnGYIj/AMAH+FPjRYv9UqoOvygDJ/xqFFI1ctDV1T4ewLbRvpttL5mzZIxXb5hHRhj/ACeK4ifwwxdkPBHGGXmumNzIikvMwUer4ApofcNyvuB75rkr4RVJXi7HdRxzpw5ZK5ztl8OodQu45r1dlpCjMwbgzt/CijqeepHSvJfEWmS6fLD5+3oFJ/2gMEfgeK9+Ej8EM3HTnOKheOOQ/vI0c/7QzW1KiqcbHNWre1ldKx8/aBBDNq1rFNvZHkCkR4LZPHTHNfdHgXT00/wnplqm9vIhCbnO5jye9eLpBEjqyxRgg8EKOK9E8Ou/9iWfzsPk559zWlrGPNc9BcZHQ1TuIdwIwa5ve/8AeP50BmJ+8351QyfWfD9vqsHkXtvHNETyjoCPyI4/CqOnfDzwraujx+H7IOvIbaxwfoTikv8AULXTrR7rULuK1tUGWmmlCKB9Sa5dvif4PWcw/wDCQQF/UByv/fQGP1qWl1GpPc9ctoIraJY7aFIox0VFCgfgKcwIHGa4bS9XstWtRc6XfwXkB43wShx+nSre9s4LN+dHoJts69AT94Z9sVzOqKx1aaKJAoGOcew6VXDsP4m/Oqdyx84nJye+aYIuyWMjgZd8d8VRl0ZXfcU3fUVHvb+8fzo3Ng8n86nluPm7Fm20ONXDRlkPoRkVvWlk0agkjj0Fee6/4u0TQDt1fVIbeTGRHku+PXauT+lca/xr0BZ2VbbVXjHSQIoyPUAtmp5Uirt9D6DXKjHNIwz2NeSeFvHuh+JSI9Pvmjue1vcEJIfoM4P4E10+9v77Z9M1VibnYNFu+8Mj6VNb269FUhT2Arid7f32/OuY8STSrfgLLIo2Do2KpITZ7N5GP4T+VRyRHP3Tx7V4Sbmf/ntL/wB9mmvdSqhZ7iRVAySZCAB69arQk7fx58OLXXrt9StI9t6wHmxkfLNjv7GvOJfAUlnvia2mXP8ACyHg1yHiH4p21i7w6X519Kpx5hkKx59u5/SuXT4ta6G/exWzjsPn4+h3VyVMPGbujro4qVNWaue6eGvhNFczLJqEckVrkFtwwz+w9B717Ha2sdtDFb28QjhhUIiKOFA4wP0r5D0L4tiaZItaSS1U8GeKRmAPbI616Pa332q3Sa2umkhcblZJCQfetqVONNaGNarKq7s9/CEj7pP4VxfjrCXdsf8Apm3H4151582MiaT/AL7P+Nd/8Nv3+n3pn/ebZlxv+bHy+9aSvbTczVr6nb/4VAanPQ1AaCRAOK8t+MPiiaynttGspTH5ieZcMODg/dXPoe9epZxyK+bfjdexyfEWeKElxBBEkg/2wDkD16is6suWNzajDnlYd4dh16/dWjnh8iM58ppSofPrtGf1xXfPoc1zp+Dp0aSH7483OR7HPH0ri/CmuW9iqxPCMY+Zo7iNyo9WUcivRL/xRBpekw3Lxq8Ey5TdMsSkdiSf8DXFGrI9GWHh0Mjwq+seG9V2yiWbTZGHmR7QcA8ZB9Rx+vtXq46DHQ9PcV5jaatJfwJd25gEYkGTDcCYOvcEhRg9K9NibdGhB4Kg/pXTRm57nFiafI1Yca56X/Wv/vV0Jrnpf9a3+9W5zDa8t+OHja40Cxi0XRwx1bUIyTIpwYY+mR7tyO2MGvUTXz18ZJkb4ms3yZit4oCZH2KMbjkk9B8wrOpLljc0px5pJHFaX4E1bUNjStHFvwcMSzH/AOvV6XwX4n8OSpf2bFZISHWSByrjHoP6eld54Q1uD7bBazw/vH/1TQSrKkpHow6H2q3N4zkvLy5tngt7YwZ+SfzS7c+oGFPua4vaz6s9J4ak0tDu/hx4uTxfoZuJYvI1G3bybuHGAr46j2P6dK6uvLvhpNFF4ou1gjVEv7QSOoOQGU5yCPr1r1H19+a7qc+eKZ59Sn7ObiHavPda/wCQve/9djXoQ6V57rX/ACF73/rsasyZS+nWqGsakun22VXdM33Fx+tX/rXDeI7wzalIFPyg7F/Dr+ufzrGvV5I6dTfDUfaS12Rj3VrrPiK8aK2WSeYnhRnA+la0fhDxBodrFNJFMjopMhRsgHt0rvvhNeW8MMhVbbfK4UyFmDHqMZI29j0Pb612fi/UU0+wdoVhklxykjMox+ANee5z3ueoqcNrHl3h7WTfgw3IxcqM7ugYVtYwemPauAur3yda+0wxxRneHCxSF4+ecZwPyrvYpVniWWMhkcbgfUV3Yaq5rle55uKoqnK62Y8da73w7/yBLP8A3P6muCHX2rvfD3/IFs/9z+prpOVGlVbU7uOw026vJhmOCJpGHqAKs1xvxZ1aLTvB1zA7gS3x+yxr/eyMt+lRUlyxbNIR5pJHiV9f3PivW2u9aka5lY5SMk+XCPRF6fieTXTaZ4P064twRYwfN6rXFaVeJZThpQp3dC7bRkV6H4b8Si1vFtL6wZZZBmJom3g8V4VV1Ju9z6CiqcFawyDw3N4bvBqegl7K5XljExCSj+669Cp//VzXs9hcC7sLe4G0CWMOQpyOa8k1DxdBcS/Z4LWXehIdt4H14PNegeApDJ4biYklfNkCg9hnpXXgak1LllscWYU6fLzR3Oiqncf601cqncf6016h5JHXl/xh+IE3hsJpOkEDU5o/MkmK5MMZ6YH949s8CvTz0OcY6Ek4xXyV4y1P/hIPiHqN2XZ4ZbkpET2jXhR9M5qJy5VcuEeaViXQdCk1W4M980js53kk5Yk9yTya7q38B289uQsEh4+9ms/w68yOfJW0Zl5MbXG1z64GK9Ps9bSx0P7RFDGBuw7yklV9eleZzym9We1CnCMdrniPiLwldaODcwtlInBPUFfcd+K9W+DXjiTW7ZtH1aUyahbpvimc8zRj19WHH4fSql9f2urSywJe2t15icoigFf1PFeQaRqE3hzxRDfRkh7Ofcfdc4YfipxXTQqO/KzjxVGMbSj1Pro+lcr4m/5CH/ABXTwSpPBHNEwaKRVdSvQ5Ga5jxN/yEf8AgAruR5zMo8V5F8XPEM0mo/2PayOkEIBnA43se30xivXTXi3xQs/N8dxxxIFM8UWT/eYkjP8AL8qU5csbjhHmkkc/4b8K6r4imCafBlCcGR/uiuo1L4UatZQhxcROe64wK9H0OG58J6diD7EkUePknEvzH13KML9Oa6XW9cs49Dt7u8KI0pC4RtwLH0P+NePUxdTm93Y9mngqdveWp8t6xpN1pU+y7QLngEHINdf8JPEM9nrK6RIS9rdn5FLcI4Gcj6gc/QVZ+ILy3UZklsJYIx91mZG/keK5r4faZJqniqxjTeEikEsjqM7QvP8APA/GvRoVJVFeW55uJpRpytDY+hzXofww/wCQdff9dl/9BNed5yc+p6eleifC/wD5B19/12X/ANBNdBzHbn7pqA1OfumoDQJDTXz38Z7D7B8QWvXjBju4opPu8bhw2T9cV9DVzvj7R7fWvCt/b3TLGEjMscjEAIy8g57DjB9s1jXhzwsdOGq+zqa7Hjl7/ZOk+HGNtax+dOuGjRMkZ/iJ64rrNOuLefwpYNJZy3MUUKsU8sgrgc7QRyR6V5vFcWGuNY7z5E1uoG/JAYA9CAefxr1C20+1k02JLryRArdIiyZA6Andn/GvPSsezoaumNp12ITpoSSGTB+Qdee4rusBTgdBxXOeFNJhtVa5gjWOJidigY69T+ddGa7cPC0eZnlYyopS5V0A1z0v+tf610Nc/L/rW+tdByMYRxXg2vzWT/FTXm1tFmjtj8nmKAFXYvT169a96NeL/HO0bRtU0/xNbhGWUiznjwPmbBKk+uRkfgKxrQco6G2HmoTuzDt/Ekc3iG2MGlyyQQMRFslBGwjvnvXUz6hYRRpqEthai5RwGtnbMzr6q2Bk+3Ncj8OdVkt9TmutHg0zdOcuk6gNn1yQcfhXV+PPE1lb28N1q50+fUNu2GO2VWKE9SCBkelcPJoerz6Jt6Fvw7cwXPjSF7SF4t5Mg5PyqOSGx1XkZr1HpxXlnwRSbUY9R1y8QJKzi3gjHVExkn6nOD7CvVOnTp2+ldtCm4R1PNxNRTloA6V57rX/ACF73/rqa9C7V57rP/IYvf8Arsa6EczMjVLkWmnXE5P3EJH1ry26vP8ASIk3ZZnCg++etdX8T9Say0BIU/1k8gHuAOtef+FtHutc1eztUlCXMjAqWP3T1ya8/GNX5nsj0sErR82fUPh210qw061W2tYxcLEHYogHJHX65Jp/2qxuNRvILqPzVbGJGXjp931NZlvpdzcWtopeS31C0wDjgSL3BB4IPFUtRtbiPW4dQvS7QwAmOEIFDSdBwOWrhVW8Oa56fs4tnmfxGmsoNelitFjihgKrsQADp7Vp+BtUW7spLV2Bmt2yB6oe/wCdZPxF8K3VhDJq+oPtvbxyRB/dUDj8a5HwLezr4r01Idx819khHTbznP6V0YSrzPmiceKgmmme1Dt/nvXe+Hv+QLZ/7n9TXAqc4rvvD3/IEs/9z+pr12eKjS7V5l8drVpND0y5QOfJu8ELyRuGBXplUNf1Gx0jSbm/1R1S1t0MjMybiOMDA9ayqR54NGlOXLJM+e/CEelNazS6rnejYQKcNn2x/StnR9Qtn8RW4vFlhVXKozI0i7QOCGPU+1cjpktpO97B5SujsxizwwGTx7Ej+VeleBWtYrFIm0+3m2KMSDcHI/2jnmvFdO2jZ79OpzWsiubbSbjUkS9MiR3O5Y5iBhm6lSpHpzwe1ej+BrZbTw8kSHcqzSYPtnivI/EVlDNfXMrS3Bj80SJB5mUj9FU4z1r2LwZFDD4X002swuIXiEgmHR8966sFC0m7nHj6lkotam1VO4/1hq5VO5IEh/OvTPJOb8f6sdD8Gavfr99IGRB/tN8oP4E5/CvknSn/AOJtalySTIOfUk8/hXtH7QOrz3kK6XZODZ2bebdlT/y0GAFPuA2cd815L4d8L6xrrzTaZbs0dqQZJeiqfQep9qxq6pm9JWkj2bTtO0ey0n+0xaxm9IIjRBncTxXSeGYorzQWja2lki3kuksQVcZ68n+VefWN3Hf6alu2+O9tmAaPlT9D7V6p4b1OKSyEK6RbJLgAskTYB9eWryIxbdpOx9AmnG8UVXi0+3hngW3Ed2CAAefl7EZ7V8++M/ITxPKkToyuAzYPAbJGPr/9avoG+sYf7UsrK1McVzcOVBJLYY859ccc49K+cfGGh32geJdQsdVVRdRzEs6nKuGOQwPoa68PF8zmzhxsopKmj6O+Duq/2n4C09GJM1nutXB5xt6fjirniX/kI/8AABXlf7P2vG31280qYkR3qb0B6CVByfxXNeq+Jv8AkIj/AHBXowd0eRPRmTVK80Ox1G7s7u4hL3NvOgDAdUOeM+nertNluGtI/PUZMZDY9eef0rLFU3Om9djbC1OSotNzsLtrSG1Eb24AAwGcDBPYc9a88+JtzaN4aW2aOdHWVX+XayoPUgGuyVrXUbmy1FIorgxdElBdNp6gqDjPua5r4qappUukXEMWkwrcgbI2EAXbkdQwOR+teNSinq3qe7Nys0loea+Lra1bw5Z3ioiXUy4fgBjx3x1Fbnwl06Gz8MidYitxcOTJIT98A/Lj261madpEXiGaCwkkkW1s7ceayNglz0Ar0LT7WKxsobW2UrDEu1RXq4Wm0rnj42pGUrInFeifC/8A5B19/wBdl/8AQTXndeifDA402/PYTKSf+Amuw4Ttz0NQHnp09anlZUjduCQpbk+gzzXjmieIbjWRfwazeXAuJnJtpIt8SJ/sYHccdc5zSQPQ9M1fWdO0aDztVvrazj7GZwM+uB1NeL+PPE0nj2/h0CzaW18Pzj95OPleXuGx2TIzg9cUniOwhk0/UA7SykQPuYhtwbacjHsa5zTvtGkKbuNPtLxx/ulWJsou0Ahhg5xnqPWr5E0RzO4yw8IzPFJGcxXsBKOo45FejaNpEdkqu67pwAN7nJrD0bxTpeoaikd1cSJqQf51aJskHoDxgEdK75rNfmxk9jn1rzJ0nGTPapVVKO5l+CPEcsvirXLN7oPZWxH7l2yY8IpJX6Z5H+Fd7puqWGqK7adeQXIU4by3DY9c9x1FfOn9pT+FPG2v6pEomtlkDOzQs4G9QDgDk9O1dJA1tI9tdaU91bJcwiVfLdlZDn7ucfd64zz1rupx91HlVZNTdz3TFc9MQJHJOPmrzkavq4aaRL++EcKhfmkc5Yn+VekWoE1lFJI+52jBYnqTWijdmTnZGVqWsW9hC8jJLKV/hQDJ/MivEvipqGpeLolS2gaK2tTvS3zlmPOST/L8a9x1OzR4X9sHP41wi+G49Qv9V0+4WSFlbdHIPuvGwBHtnKt+laujFrRmUa7vqj5xgt5g5j2vFMpwwxg/Q11fhnwjJcXCTXrboQMgA5z7Zr1/XfBd9NNa3FvZRzeWGR2hVUIHG35R16GqV9oWvQWEnk6XMu0jaQMAe+e1edUjKMrI9ahySjzSOi+GEbGLU/JTFsjKgYDgvgdPwx+NduRyRx6gCue8FaS2iym185mt/siFV6fOXYu/1JzXUsgjlBGOuM+orthSSjuefOq3UbWxWPSuG1s6dp91e3+v3sdlZmZlQOcNKcZwo6mvS/s8UgO7A9wa8i+M3iOOwvLXRYtMgu3VftLS3ETOkeR8u0D+I/WvOzCVSnFQp9dDrwajUn7x47481yDV9eUwl4baNB5e5ecf3iCeM1f+EMf2nxUJYriMXMIyqNgBgff1rjBDdX+syyXltPKZmI2+SR9MDtivTfhz4XutI1/Tb7a58+doHidedoHX6f415uNtDDuDerR6lGzldLRH0DvlkgU3NmzMg4eM4Yfrx+ZqNoAGFwsL+evAaY7yvuM8CtG3hQRL+72ZA4GR/KntbxY/1YyOQSM4/OvlVKso2TdivaRTPIfivpp1DRnZFnurpTvjETfKo7kf3sflXz5a6oLK+hl0gvHPGcgleTjqK+y9atP3RnSMyOiEbRj5h3Bz2/GvkjxJo7jWrue2tjEJZ2kjjjBZVU8jBA5Fe5k1S0XCaCu1OKkj3rRE/t3w3Z6nDAIJ5Iw0kQPGfau18PgjRbMEYITkenJrx74S+ILizvrLS54AtnPuKsd2UPcYI9c17zbQKI0CYAIJAr18urVfaSoTWm6f6HBjadOKU4laRxGjMQcCuZ8Sw2es20Wn6jcRQi9zDbxF/mlfsAO59q624txLE0ecFl/WuO17wDY6vPJLdhpLkuu2Q8lfYHsPavaUE9zzfaOOyPmzVNJ1HQ9VntJ123Ns5jYr90+hH16/jXSeH/F+o2/7lbQtJgI+MDI969W1Pwg8Gnx2V8zXNn5jGOUnLQt2Iyf/AK1Ycvh2ysJ1mkjQFfvtjG415eLiqDva6PXwTdf4XZmHD9t1Hz7y9CIqISqqOF4P55r3H4f2EQ8C6Gqqqj7JGR5Y4DH0PcVzPh3RXu4hc+TtiIzGrDPTo5459hXQWPhzUNPtrRLHW7mF4HLeW0aPEwbkqUwOPoRiujA0GouctL7HNmFZcyhHWxtyWjg5jO5f1Fc94hvHsIHaFPMu3YRW8WcF5D90DPB7n6Ka62085oVFwIzLggmPIVvf2+lUBosF/wCIRd3EhYQIAkWPlBI+ZiPwA/A+tdEvdOSHvM+avGPhzW/FGunTNLhaa2h+T7S5YRzsuWbL4xu3FwM9gor1n4FeGpNG8AzW94irc/bZjIA2cDjAzXp8+nxqTAAAjYaI9drVk+H7ePTrq/tCCIrmRpQOmN3UAex/nXJNtys9jrily3W54D8ZtD/sPxpZ3enHyvtlsZCF4+ZXxVPQ9e1udfJSSGPsXMZJ/wAK+gfEnhTSdcnspdes/Pe1BWOQE4ZTzg4IqlB4D8KtIfsGjKWzyzPIFH/j3NYzpcz2OmlXUFZnI/CPS5dT1u71WeV7hYP3MbvyC55Yj6Agfiav/Fb4QDxtqUmq2l+bW9FssKIyBkcqTjJHI616boek2WiadHZabAkECZwqepOf6mr11MkEBdu52qMck10whaNjlq1OeVz4mfw14l8D+I7aW+064juIZQ8bxjfG+08kMueo7da9qvdSt9XMN3at8joAyk/NG3dTjuDxXuIgCR7mGXPX2zXmPjGwtpPF0VlHPa2r3Sg/PwGY9+nNa09zCdjks4GT0rH1jUzHqNhpkcDu13vZpOioq4yfc5Kj8a7LRl05/E0thHexySWjMLgzW7FSB6Hj8+ax/EegXdvr0t/eXMSsMmxt4xnzlIyEAH3QQG/ECrrQfs5W7BQcVUi33MpYL/TVa40a8EDkZMTjKN+HauF8Y+JNcuj9kvI7ZGI+Z4xkmvUXh8/TWvbcP5ePmBBB9x+FcJ4l0O4VBchS5lX5AqnPNfPUZNStNH0dWKcbxZR+FGp2yC806QuLx5fNDEZVhjGM+uQa9GryfQ7K70K+a/ljlRZFeNRs+9IRlcjHIHJrrPCXiV9QvRY6jLFE5B2TPGybsDIBGMZP8696jK8T56tBqTOsFaF9NcQ/DXWfsr7JJLmKNiDjg9R+VZFldQ3is1u+8KcMACCD6c10Nro51jw5cQxHbOtwGUEEhhsPB/xrPGTcKMpIMOk6sebY6hHbevzH7w7+9dasUYHCIOP7orkF+8PqK7MdOK6LGNhhjjwdyJjv8o/P/wCvXnXxD+KeheDpZLSOIX+qoQHt4iFWPP8AffGAfYZP0rnvjl8Up/DryaFoIaO/ZA0l3nBQH+FP9r3r5keWWVmmmd3lYk7mOTzyTzWUp9EaRp23PXLr48eJGnLw2GkQoc4QW+8j05PNaujftCamnljV9FtLlM5d7ctG5HfAORn+dc38OfhlJ4jsF1LUJWitCxCIvDOB710OufCfT4rVzZ+ajgcHfu/AiuWWJinZnbDCTlHmR7z4X8QaH4o09bvRLi2uEYAugVRJH7OvUHrW15cYH3IwPQKK+H4bnU/BviFZtPuntr2Ej5kYgOM52t6qe4r7C8A+JofF/he01eEBJJRtniHPlyrwy/qD+IrrhPmWhx1KfI7M3gkfTYmPTaK5Of8A18mP7xrrq5Gf/Xyf7xrQysR9sdqiuriC0gkuLqWOGFB88kjBQB7k/wCelSnivKvF8eq+NvFFxoWmCKK2004d5j8mduS347gAPrUVKnIrl06fO7JGlqfxd8O2UjCH7bdIp2+bFFtjb/dJPP5VPpPxZ8LajcJbvdXVmzHg3kJRc/UEj8eBWHbfBXUXtt1xf2sDY+6gL/ywK43X/hJfaXbzSNfW0kYzhduCa5vrKvqdX1R290+iEcOqujAggYZTnI7YPcUuTnOTXk/wR8Q3bxT+HNTJkks0328nOdndcnrjqPyr1iuuMuZXRyShyuzQbjjqfzrqbGKN7KAvGjHYOWUE1y1dZp3/AB4wf7gp77ivbYf5EIORDFn12D/Cn7EznYufXaM06uR+J/i+Pwd4ZkvF2PezHyrWNj95+7e4UYP41LStdlJtaI6LUtS0/S4RLqV7a2kbcK08qoG+mTz+FZ0Xi7w5LeJaR65pj3D/AHUW5Q7vxzivmKx8I+KPiFcvqt7K7iZstc3R4Yew9PbpU3jL4VX/AIbsW1KymFzbx4MgC4aP39xXM6sL2NlQqNcx9ZsFI5CsMdCBzTPIizkxR5/3BXgXwF8f3Qv4vDmrztLbzDFnI+SY3A+5n+6ew9a+gB0rohZ6pGLutBnkxA58qLOc/cH+Fc3qrFdSn2kjDYGPpXUVy2rf8hK4/wB7+gqrJO6Qm21ZlQse7MfxoaXarM7lVHzElsAe+e1H+Irm/Htjcaxoi6PYymG4v5RHvzgKi8vn2xSlLlVxwhzyUe4y+8daFEzol59sdR8y243/AM8D8s1yz/FrS0nUXmk3EUecM5ZGZfquKuw/Aa1+zps1mUSKAADECv5Z6e1Ude+DV7cRBY9Rt1kUbQ/lkAn1ODXFKvN+h6McLTWl9TvfD3iHTNetfO0i8SdFGGVThk9MqemP/wBVaxd+m9vzNfN03hfXvh34i03UI54Jl80K0kSnG0nDKwOOoJ5r6OU7lB9QD+ldVOamtDirUnTeo/e/99vzNdLov/IOjb+M5ye55NcxXTaL/wAg2L8f51ruYl5jnlicDnpmuH8ZfEvwz4UuhbahcGe87w2qiV0z/e5AH061x37Ts3iC38L2UukzyJpLOY79IsgnONu7H8HBznjOK+aJZmZ0t4iSuecdx/nvWM5u9jWEb6n2f4a+JnhXxCIks9VhhuJScW9yRG5x+OPyNdSl/ZuwVbu3Yk8ASqf0Br5/8A/B2xvdMhu9faWR5UV1gR9oUHnkjkmtjxB8LfD0dm8cdiY2A4kWRs/iSea5XjIx3R1xwUpuyZ2/jH4p+GfCuorYXtxNc3ucSw2kfmND/v8AIA+mc1mwfG3wNPLEj6lNAznGZ7Zht/3sZr5j8XaEdAnIiy0bngk5Irk3mYnnJz710Qqc6vE56lL2T5WfofbXMN3bRXFtMk1vKoeOSNgysD0IPcH2rJ1dFN3uKru2/eI5/OvNf2W49Rj8A3X25JVtXuvMsy44MZX5mX2zXpmrf8fI/wB2t4nOyiEUEkKoJ64FKyK33lU9hkZxThXkvxo8b3OlMui6RL5NxJHvuJlOGVT0RfQnuev50SlZXCK5nY1/HvxL0nwxIbO2WO9vxw0KD5Y/94jgH2/OvO774x+IzOZLbTNOFru+SN0Ltj6+v0FR/DT4df8ACT2r6hqd7JFZCQxpHAcFyOpLHoK77WfhVokkK/2e81pMoADht2QOxzXFKuk9jup4aTW5meFfjLpWo3Edt4h07+y5G+UTcSQ7j68ZX9a9ajWCSMPGsTI+GDKFOR2II/Ovlv4heCbjRCJ/PFzB/EQm0iu3+AXjeeef/hGdUuEZUjzZM4JdvWPOcYxyPxralV5tjCtRlTdme4eXGDkImT1O0Vq6Qo8qTAAG8dB7VmdRWpo/+ql/3h/KtnqrMxOcX7w+orr5N4iYxqC+PlB6E9s+3rXIL94fUV1t15gtJjAC0vltsA/vYOB7c457U3sLqfFvxQuGuvFuos05u285kkuV+47LwVT0Vc4Heucsbc3l9FCqO5kYIAg+Y+uPU12vxQ0s6NrNtpEwU3FvAJbiQfxyyMXc57gHAB68Gs74c38Gl+ONMlnQNl9g3c7WI4/WuWcrJnXThzSVz3TwVPqFrFBaBLtLGNQpjuo0yOOoZf5VLr02oz3LbGvZIGO1I7UomPckg5rW0++m1C8mjZAs68iBgqhhjggkgsPUjgHiqN1qVxpV9Hb+XunmO5oVZG2D1PzZA98fnXl+89Wj21FW5Uzw34t6e1leae8nmb5Ebd5uN/bhsd+1dp+zDrctv4k1DRJJALW7h89EY/8ALVcfdHupOfpXF/GjVPt/icQjBEEeTgdGPb9B0ql8J9WXR/iPoV7KJPLWXy22DJw6lf616NC6SPHxKTnJI+1K5Gf/AF0n+8a6843HGCM9q5Cc/v5P9412nARnoa5XSLG7s/Fuu3axuFnAlhCgHcNoBIHc5GK6rNNBMDNJEmZCGIH95scDP4VyYy/KmjvwLjzu+5V0LWNTu765hvbR4raIHEkiBc8dsE5rzTxX4o1HU1mMOnNHaeY0asE3tx3ODx7V6dC129vN5hkhnQg75hGIWyP4Ru6fkc9a800C5ubK91SzuDvtxl3dlVUU9TtO45P0ribVj01FdGYXwskih+IEj3JaOWS3McYK/fdu3twK9w+lea/Drwu/9qt4hunURSA+RHn5s9Mn0x2r0o16OGvyanj4rl59ArrNO/48YP8AcFcnXWaf/wAeNv8A7groOYsfWvnP9oC6n1f4k6JoKf6mKJflC5wzn5jj/dA/Kvos9DXz54tvorP9pa3eYqEZIocsehMSkHNY13aJrRV5ne+CtTQyS2CMWgt9sa5sng46DaTww468VNr960t9Jp06XUltOhXbb2HmJtPB3OT7+la17dobm3iSNyw+cxqjE4/AdKtQ3JWZIjFLuYZwY2X9TXlJ3PXcHY+R9UgufDPiea3DNFeWku6Nx8pyDlSPTNfYnhbWY/EPh7T9WhXat3CsjKD9xiPmX8DkV82fHyOEeO4Zl2iVoEDqOvoM16Z+zlqi3Pha90xnPmWk+9FPaN+f/Qs16VCd0eZXhZnrlctq3/ISuP8Ae/oK6muW1b/kJXH+9/QV0HMU6oXhePV9PlhAkdBL8uePu9a0KcksMMkLyABg+N2exHSsq3wnRhbe0Vyro3ie+n1SS2ubKQoD99IHVV/E9frVfxZ4j1a2uZYNJ09pEi/1svl+YO3QAjJwadL4xE7PHYWZluFfP2Yttcx5I3k9gSDj6daxbTxlPp2pXa6tZR2glf8Acx+ZvaRj2HoenFcXQ9VQ62OP+I13faloU0lxblN5URsIym8k4wQehr1GxmjuLK3lhdZI3jXaynIOAM81yPi+9/4SGbS7W3RV+0SKfKc4OFOWBHBGADXZQRrDCkcYCqoxgDArfD31sceNUbIfXTaN/wAg2L8f5muZrptF/wCQbF+P8zXWecWp4YriB4biKOaFxtaORQysPQg8Yrwr44fDPTrSy/4SXw9p3k3EUqG8igOEMXTeExwc4zjjHaveaZNEs8EsUgDJIpUhhkHI5zU1I8yLg7NHnNxr13pl/aWdtHcyeYFCqtiSmMD/AJaZ4OPameM9U1CMCOGIRYXfI/lGQqvsPWtK51m6TU/sHlm2jiAUSGNpN7dgcdB75GayNc1G+sL/AO0XZjgjOI0/0eXMh9Bkd/xrxJflufQUls+54Z4/uHv9JlnEkkyZ+VpbfyWz9PSuq+Afwo0/XdOk17xTaG4t/O2WduzFVfb95nHcZxj8a6TW9LvfHGpwWunW4jEWDO7EBYeep9fpyT6V7N4f0i20LRbTTbIEQW0YRSevqSfckmu7BXcXoedmFlJa6ly3gitoY4beNIoYwFREUKqj0AHSsvVv+Pkf7tbFY+rf8fI/3a9BHmFJt2CFGW6V8jeLrnUfEfjC/mnixO915G1ekfO1R+n86+ulO1gcZI7epzXh9ha2fhbx34h03XAkaagy3tldycK5DkhQfUs2Me3vWFdvlujowyTmkzq7WHU/CXh60sNIt2mWGMKGEJkJbqSeRjmtW+12/wBN8NHUb+BJLw7VESrtGW7kdquXniOO1S2VYmcMuWkA4ByBgnscmuf8dX+otoTxfY4mEkgfLBlwo5HJwDXl3drnuRinoefeKdQ1fV4ZrfUIY1LjAxCUA49ckGuH+F2kvqHxI0m2Erx7J97Og6BMnP0OMZr1SPxPaXnhS6jkVUuoUAkYAEHt8p7103wk8IwaPaSazJse91BFwFGRCmSdoPXJzk/hXRhL8zRw41JJanofXJ9a1NI/1Uv+8P5VlmtTSP8AVS/7w/lXpHlnOL94fUV2LrvUoSQDj7p5H0rnLnTJ7fDFd6AjlR7966P+HJoEj5R+Mvg/WNO8RanqZtD9gllzE0ZLnaR1Pfrnk9K4fRNHW8uMagskMYHlpcZKrDK3KMxxwuevfvX21qFuL6FkESvhSp39MGuE8ZeHopdV05LyRSq5nfCAB3X5VHHGAD/WuWuuSLkddC85KJW0qaSLRYEvWJlRBiUR7g3HWsTXLthDK1jmWZ15YJsFdlGg8r+EgcdKpXFlH5ZLIcN/dUmvI9oz3UklY+UdRE0+pXbzktI0pBY967X4K6RFqHxB0yG9Q+S6SYZgcBgpI7YJH/163fFHw3vbrWTJpCs6XEwAQqQVJIyR6jGT+Fe2fD/wqfB+mpaDZcspZ2fHIZsbgp9DtH5V61CSqJNHiYiLpt36nbjtkc4xXIXH+vk/3jXVxShxnDKSM4NcpPzPJ/vGus4iOkYFsKhCsT6dadjOMZ56AVZGmXzpFNHCSm7nn5vyrKv/AA2bUHaomZep3zWdk4ubZ2APJByK8T8Vaz9p1Cb7Mh25+6oIGff1r6DvrRpIGR4HO4Y27TXJ3/gGa7hxa2gEj5yz8KB715KhPRWPZdWLTuy94aIPhzSSMc2kXT12jNaNZnhrwtqPh6xa2utQF4M7o4wvywj0Dda1mhkX7yH617EL8queJUXvOwyus0//AI8YP9wVyZrq7AhbCBicAIDVvTcz8iwTivk39opntvileTRuySmOCaNl6gqgAP5rX05easy5W2Uf7zV534n8H6X4m1VtR1W2EuokCNpQxACr0wOgrmqVYvQ6adCd7mT8LfGbeLNKB1y0ZLi3whuFGVlPqPQ+o7fjXoF3frp1mXsbcMWHLyfKOnfvWH4c0SLSLM2trbRwoGJK9iT3+tVPFbtbWjyTMkcEYyRnJbj09vT1rgktdD0oyfLaR89+Lb261DxXqd9qMpkcuSWA4CjoB7Yrrf2evFK6X48WyuXRbfU0+zsWPAcHcnP1zVG00JvEurSRIDGs24bsdh3rr9D+EWkLcILia6luFIkMkcpjEeO/HU11QmopI45UpSbZ9HfXqeTXLat/yErj/e/oKtaVqbJGkMu6VIwEMrHLHHGSe9VNVIbUZyOQW6/gK64TU9jjnTlDcq1W1SzW/wBPuLVmKCVCodeqnsRVmpY4HcZwQvdqu3MrEJ2aaPP/AAt4tfS7afRdd/c6paOyxMThXX6+h6/jVbxf4+sbOzeS3l+06o6FOOVQkY4Ndjr3hO01azWK6QTPFkCRhhsfWuNi+GlhHcFhGwXOcs2TXnSg4to9yNXmjc574SCa78TPqWrEiR42EGcnMh6t+XFezViadoENsu9Ygu35Y/b1rfW1mVFGM+mDXfRpyUEzysTJSmR102jf8gyL8f5mubaN0PzKQB610uhqW06FQMkk/wAzV2Zhcu0VOltkDe1Q6tGIrEtGXGGXJBxxn+Xr7VEnyq5UVd2Oc8Qypa3iSqm53jw+w4PXj8a8x8Sa4jyPGkd4ZgT8spyAfWvSru0JbKgmuQ1jSPMuzKqNuPNeBOq5SbeiPoaEYwiluxvwbuzHqeowXLBJrmONokPUhS2cep+YV6tjGeOnFeKSeG5tQvIoLdJPtJH7sxsVK5/i3DpXtllZNBaQQmZpGjRVLOckkDHXrXqYGblDlsebmNNKq5J6sbWTqn/Hz/wGtxoXXqARWJqhzdDbydvQCu084pHvWR4m8P2PiLTmtdQiBZfmhmA+eF+zKfX+feughspZiCVCj1NR6jZzW0iqpBVhw2O/pUVGoxbkVTTk7ROGsnXRLpbTU2HkyHb5zD5H47+hqt4n022+xuLa5ENu4xgSlcZ+nQV2t3YW15aeTdwpKn91hmvM/GPh7y5NllNJhgAIixIAryJO2x71KbWhyNvYPqt5a6RpMckthazI0726BzgnltpI3KMc/XNfQIVVVVUBVAwAOgA6D2rxDwxNc+GNZW4SLzQVMbxDjcD6e4r2PStRi1S0W4gWZVbtKm0124OcWrdTzcbGd7vYu1qaT/q5P94fyrL7itTR/wDUyf7w/lXbY4TVaWHH+ti9PvCiXywMBlx9favCEA8xeB94dvevTOwpsSdjqFlKIBCqseMktgAf41BqcEU8JddpmQErkj8vxrnse1H5VMoqSs9i4zcXzLccr+YmGjGe4xUYWRmCRxjJOPSnMdqkkgAdSTgD6ms6XXNKilWKTUrMOxwF80HJrgeBV9zvWPl0idHaaQsFykzyK84HykHAQnrgevvV/wAvy0Y+ZvwCPmOT+dc4ro43KyMOzKQQadj2rthCNNWicVSpKbvI3o5F2AHBOOeaxoNM+0ySPLPHChY4ywJP4VGK83u8fa5uB989qtGbZ7HaWNjbYKyxu/8AeLDP/wBaryzQr0mjx/vivBio9B+VLtX0H5U0K57z9oi/57R/99CmvcRf89Yz/wACFeAT3VrbnE89vEfR3UH8jT4Zreb/AFMsMnf5GVv5UaD5me5yNCSSZI/++hUY8j+/H/30K8UIHoPypcD0H5U9w5j2We1tJl5MOfXcBVa/mVdJgjtpAytxkdwP/r15Hgeg/Ku90jjSrT/rmKiceZWKjOzvYju7toI23AjHAP8ASrMce2Unr2qXvSjjNcrwq6s6vrfZCr8xAxXE/FBHfS5Hgc+ZEh+X1J5z79MfjXWXl7a2Sbr25gt09ZXC/wAzUdnqun3jAWd/aTsegjnUn8s5p/Vl3B4p9jzX4aafcPGdRuYpIIooFgijZME45LH69K9Dtle1twJP9ZMd7Doc/wD1hitTJ75zRS+qp9QWL7IZaxlIgWPzY+g/KpEgEtwyl1UA8kn2ptcvqo/4mVx0+9/QVtRoqDuY1qzqK1juILe2j53Ix9S2aNS897NlsXtlm6K0xyq+5Hf6V54R9KTAHUZ9q6VK2yOc7HSrObSov9LvLjUGdizyFskZ7ADoPYfpVvVL3TrG3VpHaaWQfJBAAZH57DsBXi2oeP8AQbOd4WaeV1baDFDkH1we+Kx5/ivpUN08X9n3rQD7snyqW/4Cen41lOMZO9jWNSUVY9wgnudQvfMt2S2skXasdxHl2Y9W4YEDsK21xtAaSPcP7vArxfwr4v0rxOJVsC8dxEAXhmADYPcdiPpXRYHoPyrZT0sjI9EZowpzImF5PzZArY0B4hYo6kKpJKgnseleR4BHQV1uggDSoOB3/maUpXGj0ASLj76/nSO6FSrMpUjBGetcgaT8Kh2e5SNmbTmBbyJYyh6KeMVAukyPhZXhRe5zk1mOyopZyFUdWY4A/GoYru1ncpBc28rjqscquR+ANcssHSbu0dCxc0rJnV2tnbWER8jaZD1fuamibLAlh+dctjnGOfTFJgegrojFRVomEpSk7yOskuVEkigqTkAc+3NVAsTSs5KAn3rnqz78fvug6VadiTtgYxj51/OnyeTKmybYy/71efYHoKMADOBRug2Z2slhat9yXb9eazbnQLWdi0tzGT24Gf51554h8X6HoDmPUr2NZx1hjXe4/AdPxrBb4r+Gwygfa2z1Ihzge4/pXPKnSb1RvGpWWx6mnhDR1lEsq+c4OcMw21sJbxKoRfLVBwFHAArz3QPEOk6/C0mk3kc+3BdejL9QeRWqfoPyrWnGEPgRlUlOT98657OBhwyj6GsbWdWbRIhbWwWS9uGJXIyqgdWP9Pesr8BVa6++KKico2i7BTajK8lc5NPvp9R/OvTOwrzNPvp9RXpg7fSqZmFc18QvE48J+HW1AWxuZmkEUUQ4DMRnk/h+NdLXHeOWtv7W0T7eN1tbs9yy7SxLAbVAUDk5IqJytG5rTjzSseQava/EDxRD9q1Oz1H7ExyIosoB9FH9RXOr4c10bktNFvW55LoS36V9O+GfFGk390bKKWaG6X/llPC0Z/DNbmpa9pWkBVv72G3Z/uqQST+Qrju5Hf7JI+bPA3iXW/B2tR2+rrMthMwSSKXOEz/EAelfRaMHRXRtysMhh3BrifizNp+veDLu50yWKee1kVt4XBT65GcGuk8Mkt4e00nkm3TJPXpW1GTbsc2Igo7GpXm13/x9zf75r0kV5td/8fU/++a6UcrIq8++IviW6trtNI0t2jlZQ0kiffGc4RfQ+/vXoNct4W0f7T8UNYvbhAY7ZVkAK5LZXA2jPsaxxFT2cLmuHp+0momHofwk1vWrBb+7kEJf5gsxLO2e/tUGq/DXWfDkK3+nXo+0QncRHlSP6Gvo201uCCOKGa0kTeOCGRgPwByK5zxrqcEcclvbwmacqS2WCJGPVieleNLFVlZpnswwtJ3jJHCeD9abW9JEs0flXUTeVNHnOG9fbNbtcT4WV4vFd664jiuYSzRAhlJU4yCOv1rtj1r2qFT2kFI8WtD2c2g713mkf8gq0/65iuD9K7vSP+QXaf8AXMVqzIuVyPxA8SXOjx2en6NCJ9c1FzHbBhlY/V29vT8c11teeeKs2/xR0u8lDGKDTHIO3od56e9ZV5csG0b0Yc81EzR8I01OM3viHV7y7vnXc7nBAPfGf/rVxviD4aw6axl0zUXEqndgrjJ7YK4Neuw/EDw/NK1iLmRLkDG14+D9CODXA+KfFuhzXDx2M9xKyfe2p8in3JwBXlKrV5rHrKjR5dUN+G/jvU9L1m38P+K5TNHOdtvdSNllY9FZu6k9zyK9rPWvnTxvZKdF0e+EbrdPNtYHr6jH4V9GP9416tJtx13PKrRUZWWwnauW1b/kJXH+9/QV1RrldW/5CVx/vf0FaowKZ9utcz43m1AxWmn6OWW5vHYF1yCqAZz/AI10/wBKisYC/i3SpJF3W4SUbVQlt23/AA4+tTUbUXYulFSkkzjbL4aL9jL3LyPc/e+UcDjH41w/iXwQbOQrDJjn5g3WvpJfFOkgTQW4kRo+GEkRQj868k8aa9aahdO9pAWCHDyMyqg/E15Sq1Obc9r2FLk+E8YR9Q8N6tFeWsjRXETZVhyD659QRX0R4T1lNf8AD1nqSqEaVcSIP4XHDD35rwbxDtuw8igbgcDacj869l+F9t9l8Daau7duDyng8FjnHIr0qU+ZankVqai9DqhXXaD/AMgqD8f5muR6cV12g/8AIKg/H+ZrUxRfPWsrxPqp0XQ7i+jtzczJhIoB/wAtJGOFHsMkZPatU9axvE0PnW9puDFEnDlVBJbAOB+dZ1Z+zg5I2ow9pNRfU8q1PwL4u8Z7bvxBrGxCNwtYAdkfHQAYGfU9+tclq/wvuNLLPBqjxuORtQqQfcg17vH4y0+0vI9OuYri3lYgAuF2kn8c1yPxA8TWD3v2G2hknm27pGztCfXNeI8RWbunqe1HDUVpKOhyPw28b67oPiey0DxJd/btOvW8uGdmy0Tn7pDHkr22nufz+gD1I7jr7Yr5Z1eMzajZ3aBPMguYnUo+4Y3g9a+ooJ0uYUmjdJEcbgyHIPrz9a9bDVXOPvbnkYml7Ofu7ElZ1/8A678K0azr7/XfhXSc5BXDfEvxRPo9vDYaY+y+ugSZRg+UnTj/AGjnj6V2F5eQWkEslxIqpEnmOCeQvrXzr4l8Q/2xrl7fSHgvtT/ZTBAFYV58qsjpw1NTlqUbfSrjW7pl022vLyTP7ybjBPfJPWugT4ea6yLKlm6lR0bHNeufDk6Xoug2kMiGCeRA2SmTzz1611Op6ta2qeY5Yg9+Fx7kniuK7Z6Xs4o+WLSTUfD/AIiE9oZIbiBvmA/UMPevpLQdUi1nSbe/hwFlXJUHO09x/n2rjviLotvrujT6zovk/b7ZSxEbhvNQdQccZrnfhB4ndNYGhzR7YrkGSPPWNwM49wRz+Fb0JNSszkxNJct0eyVVufvCrJ6c9etVrn7wrsPPOTT76fUV6YO30rzNPvp9R/OvTB2pskKzrmyW51lWmYtG1u0aoDjGWGSD2J9a0ay9elezSC8Q4iRtk5zjbG3fPseaxq/AdFCSU7sq3On6HpuqWkFqlvbTyPnzMkFiO2T1Na19YadrLbLspKitjAkIGfQlT1rkodNih1VJpW+26Y0YaNjjejf3skHII+ldBJpEdwqGAi1tcZcKwYuMdBwMH35riT6nsuKSLHibQoJfCl5psPmETIIl+Yuwyw4BJz69TVm1s00+2htY23LCgjBxjgDFZ1hqcl5qMVrE4dLNFaSTOcvtwAT64yT+FazEliScknmuqjH7SPMxM18ICvNrv/j6n/3zXpIrza7/AOPqf/fNdKOJkVaelWNnC8eoxkGeVfInVu5zkH6ADj6msypLdyk6MPXkevWuXGUXVptLc6sHXVGom9mdBDo/h+21Rr7T7Ga5ubcbpBCS2GPbBIBPesLxBLo2ta1qFpfwXSRyBQZnQxjcB69x2rQ0uzsZ5Gkjgt5rhSxMUx+Uk9cqeM8fexmuQ8fA/bbd7ixtLZY23BINoMh/2ioGR7HIrw1JSjdbnv8AJyy12KGi6daweInNgCba1iaMMT/eNdPVHR7U2tiiyAea3zvgdzzj8KvV72DpunSSfqfPYyoqlVtB6V3ekf8AILtP+uYrhPSu70j/AJBdp/1zFdBzIudOa5TxFcaVb63jVnHlpAZmzyQD8pGPT5c498966uvF/j1aXFhqGma1a7vLkDW0/GVGORn65I/CubEU3Ujp0OvDVVSnzPqbOg6h4SguhqsVhOrSMTCViaRlX1OBgZ9u1ef3eteHjq0yC1u/skshkuBjZzn5SOOR+Vdb4A1XRIfB8t9/YcExUFLhViD8gYBI69CPTv1rz/xlc6feSfa4NJisooyVjRUCh2OOw5P4muKNJczTuejOq+RSVrHW6pd6a2i6WlivmvLcs8EcnVD0BP1r2bQYZLfRLGGV3d0hVSznLHjv714L8EdIGteLJby7LeVYRiVF2gqWJwFIPTHUYr6Jxgn6130qfLqebVrKatYXtXK6t/yErj/e/oK6o1yurf8AISuP97+greJzWKlWtMghur2O3uXaOGTKlkbaVz3B7GqtIeh5xx1Bokrpjg+WSZHo+haDa61qaW91JdyRL+9e4YmKLjG0Enk8Zrzy0l8NTzXWnahGJIA5KywtjnPQnFd54Nt7WzXXbU3bticNPG44ZWQHBbBOcHjqK4Px/Bpi3gfTZppIMZYBGjHHbJOPwxXjuFpHvxqXhdLQ5PxTDYi9gsdLRY4XlWNBnI+ZgBn8TmvZtEsF0rSrWzVt3koAW/vN3P0r541G/Fvd215Gg8uC4jkK+oU5x+lfSUMgnijkjIZZFDAjpyM16VCPunkYmV5DhXXaD/yCoPx/ma5EV12g/wDIKh/H+ZrY5kXzVHVYg8KuXZVjYEgdDz3HtV41W1G2F5p9zbFinnRsgcdVJHWsq0OeDibUZ+zqKRyaab4en1ua4jjZ3tjiSZuI1b68kmuc8TX2gJ4mvGmnhuvtG2MxxkFmXHUkjGK2vCRjlvZbDUJZ4NQtA5ltomwJx0L9j19Disbx3Y2UsLfY9NvbdidryyyOmOc5HzY/SvDVG3xPU9+NRbo5LxZb6bJcWdt4ehz9pISOIAKSxPvxXtvhPS20bw7YafIEEkEQDhOgbJJx/n1r5/8ABp/tz4maRDblVtbefIAOcKqnk+pJHJr6XJycnqTmvUwdLlV7nk42s5ysFZ1//rvwrRrPvv8AXfhXacJ5b8b5ZotEt9siLBIxjKFSWZjz19MD9a8VuYkHlrM+BgZweFJx/Svb/jekzeF7Zo/K8pbpS5fqDg4x+v6V4VOj3U0Qt8tHuA3EcMfQev1rjrfGehh3aGm59Nad4a8K2S6bcyIJbp9pjxISNxUZP6Vu6wmm3kL/AGuNLm2TjAXdtB45FeS/CzxHZ3moRaNrdxJa6lagx21wjlBIP7pIPX2PBr04WrxXNxJqNxFFbMCZJVuW3Ee7H7o+mK50n1O9OL1Rma9c6R4V8G6jfWNrG0Kw48qI48wfdAz9P5V4N4U1SO08Z6dqMdt5URulRec4B+QAHvwRmtv4seNbXVwNA8PkjS4282aYcCZx0A/2R69zVHwRpUWr69pumysYR5Z5HUnB+77961Sasc1WSkn2Po49SPTj61VuvvCpoI/KgiiDFgiKu4nOcDGf8feorv74ruR5L3OSjILIQQQSMEdDz616YOorg74eEERptK1/R7abIbyxqERjb1+Xdx+Fb03jLw1DF5j6/pJGOAt5Gx+nBrz8vzGOPhzRi4tbpqxrVo+ze9zfqjrF/b6dp09xeBWjSNm8sgHzMDO3HeuM1L4h6Y5aOy1TT4gePMa4jLfgM8Vyt54i0uW9tjdaxazoX+cm5RuO/evT9nvcw5tiSCDV9NZL3w2gnsLhfMjt5HP7vd2XP8q3bXTPGmv7Ybp4tKtH+WSSN9zsD1AA6fWt7Sbzwxo9v9li8TaHNbD5om/tCHKA84ILVtxeMfDgAX/hIdEGPS/h5/8AHq872cr2Z63tk4qzKE8dt4Ul0fTLBMW8wm80Hlnb5SGLdSfvfnWxb3cFyMwyK3tnkfUVxvirxLocurwyrrukyeVGSuy8iYDJ9Q3XiucTxJpXmORq2nj5iwIu4xj6c130ad4anm1prn0PXenWvNrv/j6n/wB81Lp/j3Todqy6xp0kY4+e6j3fnmnR3Xh2bdNN4l0dWkOQi3sWR+O6orVI0fiCnTdV2iU60tO0i5uUM+xkgXnew6/SsG08Q6VpusFpNZ0q5ijbBBniKkeo5616Mvi7w1dQJt8R6LFkZw17Dke3365MTWny8sFudWHowvzSexga5oVvc2rSqPKnUYLK2DXkHiLTbu2ug1xPJJxlAzE4WvcNS1/wzMm1/EOiNyvKX0XIB5H3q5jVZ/Ct/ezzSa5pA3bVUC9i4UDAH3q8H2dSm9Uz2/awqK1zI0fVFvrdfMVo5gMMGHBx3BrSPHWsbUdZ0bSrWRtP1TTp2IIC/aY359cAmqHw7urGbVm/tbxHaR2oiaTbNfRopfI4GT9a9vC4qpKnzSjsePisNTU0oy3OoyOK7vSP+QXaf9cxXnmt6zoFnepHa6xp00THb8l3G2PfINSt8UtE0+3S2hIuZIRsYi4jVTj0OTmuulXjVXMjD6pPn5Fqelf54rgfjJNay+E5NPkmQXE0kZSMcnjPOO1chqfxTur55Y7K7s7GPGBtkVn68/Mf6VxN9q0N1e3FxdX0dxJIiAyNKCx/HNVJ6Ho0MrV+arNLyuc4f7W0cyxobiFH4PVQ/wDQ1nzXc07BppGZunJzj6eldHceIDuFtJNFc2gAURyOCF5PQ9vzqPxNHpFtZW4sJoHupPvJE4fYPqOP1rDmakrrc5quHim1Gd0juvgv4p0/RZEsroCOO7OJLhyAqsOg+nvXvMUqSxJJG6ujDIdTkN9CK+MluA4Zd8aqBjBIwR6fSuj0DxTqWieVFpusSW8KDPliUFP++TxWydtxfVo1PhZ9XVzWoQyz6tNHBG0kjNwqjJPArzbSvjHcxW0a6lDZXUhHzSJKIz+QyB+Veu+C/GvhifQINRn1fR7K9vB5s0M1/EJIzkjackHtn8ayr4n2MHJK5jUw0qbtL8yrH4c1BseYscfqGbkfgKfPoLW0sKzXAKv3VT2rcPi7wuST/wAJLoX/AIMIf/iqVvFvhZ4ireJdDx2/4mEPH/j1eAsyxk5+8rLyRrCnRi7vUwrHRLSyF40ARZ7lg0jh+WIUKD+QFeWfEnw3q0wPkXcj2yjkNjivTr/xT4dSbadZ0RlPRo72Ej/0KsbWdf8ADtxAUTXNKIPYXkX/AMVW/tarlzNXPXgqThyp2R4C+h+dbvFKvyE4x059a9S8J66Psthpk9vL5sarAkifPvxxyOopzXGhSucapo5J4A+1xD+bV0fhoeF9NkF1ceINEN0QdoF9CRHn/gXWnXzGeGp8yjd+jOaphKLd3I0ZbOeIAtGSPbnFdLofGlw57Z/maojxP4YCk/2/o/H/AE/Rf/FVXv8Axr4ds7KaaPWtKnaNdwijvotze33v6U8pzWvi6nsq0LeZwYnD06a5oM6Wql9qNnYqn2y4jiLnais2Cx9AOprym/8AiZc6huhsL/RtODZG97hWYfiTgfXFZNnqMKytNf6tpc0hJJX7fHKrH+8NxBU+4r7Kll11epNI8WpjOV2grnpuvaFb64gv4p57C/jy1vcQnEijGPxU+hrw/wAY2+u+a9vd65d3cK5PzLtJ9RxXZ2XjaPT9yLe2L25OfIa+jYe+1gePpVO/1rQNcnlmfU7O2iVclZZV3Z9BgnNeFjcFWw1S6XNF9Ue7g8XQxFO1+Vo5LwVdr4W1yx1BoC6QEs6LgMwII6n/ADxX0J4Y8VaR4kg36Xdo0n8UD/LKp917/hXzTq15bSMyw3NuQSTkSjkfnWXDOtvOs0F3DFKrZDrKAR7jBr0cJgJKF6js2edisZCU7QV0up9jds9qz77/AF34CvDNA+Lmq6XEkWoTWuqQr0MkgWX/AL6HX8Qa9Y0bxn4Z1ayhvpdZ022Zk5gnu40dD3BBI/lXPjH9Ui5S19NSqP77bQ5z4pWUeo6ZbWl1L5FpI5MkhycYx/Q14rqDw6Zcyy2/MSEpboeGI6Bj6A9a988Wa3oWpWN3bwa/o4kkQon+mxYBxlf4vXP5181aokg1IC4ntnEeQGjnVw3qcgnP1rxcLjJYxvmjy2PWVNUIJxd2Jo8s8eqi+bazIwMnHBBPT6V7L/ZcXiGwREL7GAYrk/livGftCLBLHHLGN+M/MOcV7t8O9Z0GHR7OS51fT7ebylDpLdRocge5rrlFy2QU3GPU8d16whsdZa32kqq7fpW94ZtodVW13hobmAnE0TEMmDnOfoazviLqFjP42u302eKW2XCh0kDKx6nBHHWuk+GEukvb3819qllaOYtqpPOkfJYEkZI7CufFTnSp89tS6PI5Wb0Pa9MdWsYNshl+QHeQQW9zkk81JJE80yRxIzu3RQOTVOx8R+GrdQi67o6hcAAXsXA9PvVv6X4t8LIjv/wkGhpJ0yb+EHH/AH1WeW5pVrz9nVhbzOTF4anT96Ej4U/iNOT75+lFFe+9zz57hF9xae/3W+hooqvskIjX7q/Skk+7RRWD3NY7Cx/db609etFFax2MmHemSdaKKznua0uo6H/VfhSDpRRWtP4jOXwCL96ntRRVy+IyfwgPvj6Ukn3T9RRRS+wx9UA/1JpT9xfpRRWS+A6V1A9V+tJH9wfQUUVDFL+IiQfd/wCA/wBaH6D6UUVMvjJQnYUDofrRRTY4iN0/L+dMf/WP/vGiitp/w0VU2Q3vQeh+lFFZHPPcSDp+FSjvRRWvQ1fQG/1a/Wol/wBZ+FFFJbkVNkH8LVIv8NFFOnuwpdR0f+qf601Pvn6Ciisp/GTS3B/uGiT+H6UUVa+FHStmKev4UoooqHuzOIveox/F9KKKpfBEcxE6CpU+9LRRRH4pEL4ATqKjj/1zf57UUVLEth7fw/WiT734Ciipj8TJ6jT94/Wo/wDGiitJmkfgP//Z" },
  { id: "tips",    label: "クイック Tips",        desc: "簡潔に伝える縦型ショート",          category: "教育",     popular: false, platforms: ["tiktok","shorts"],         thumb: "data:image/jpeg;base64,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" },
  { id: "service", label: "サービス紹介",         desc: "SaaSやアプリを分かりやすく解説",   category: "SNS広告",  popular: false, platforms: ["shorts","reels"],          thumb: "data:image/jpeg;base64,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" },
];
const CATEGORIES = ["すべて","製品紹介","SNS広告","教育","企業イベント"];
const PLATFORMS = [
  { id: "tiktok",  label: "TikTok",          ratio: "9:16", ratioLabel: "9:16 VERTICAL" },
  { id: "reels",   label: "Instagram Reels", ratio: "9:16", ratioLabel: "9:16 VERTICAL" },
  { id: "shorts",  label: "YouTube Shorts",  ratio: "9:16", ratioLabel: "9:16 VERTICAL" },
  { id: "ec",      label: "EC 商品ページ",    ratio: "1:1",  ratioLabel: "1:1 SQUARE"   },
];
const PLATFORM_LABELS = { tiktok:"TikTok", reels:"Reels", shorts:"Shorts", ec:"EC" };

/* AI Models */
const AI_MODELS = [
  { id: "kling3",   name: "Kling 3.0 Video",    provider: "kling",   badge: "NEW",  desc: "最新映像生成・マルチショット対応",   quality: 5, speed: 3, thumb: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='169'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%237C3AED'/%3E%3Cstop offset='1' stop-color='%234C1D95'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='300' height='169' fill='url(%23g)'/%3E%3Ctext x='150' y='80' font-size='28' text-anchor='middle' fill='white'%3E%F0%9F%8E%AC%3C/text%3E%3Ctext x='150' y='115' font-size='13' font-weight='bold' text-anchor='middle' fill='rgba(255,255,255,0.9)' font-family='sans-serif'%3EKling 3.0%3C/text%3E%3C/svg%3E" },
  { id: "minimax",  name: "MiniMax Video 01",    provider: "minimax", badge: "推奨", desc: "商品・人物の一貫性が高い。EC動画に最適", quality: 5, speed: 3, thumb: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='169'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23059669'/%3E%3Cstop offset='1' stop-color='%23047857'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='300' height='169' fill='url(%23g)'/%3E%3Ctext x='150' y='80' font-size='28' text-anchor='middle' fill='white'%3E%E2%9C%A8%3C/text%3E%3Ctext x='150' y='115' font-size='12' font-weight='bold' text-anchor='middle' fill='rgba(255,255,255,0.9)' font-family='sans-serif'%3EMiniMax Video 01%3C/text%3E%3C/svg%3E" },
  { id: "kling3o",  name: "Kling 3.0 Omni",     provider: "kling",   badge: "",     desc: "音声付きマルチショット対応",         quality: 5, speed: 3, thumb: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='169'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%238B5CF6'/%3E%3Cstop offset='1' stop-color='%235B21B6'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='300' height='169' fill='url(%23g)'/%3E%3Ctext x='150' y='80' font-size='28' text-anchor='middle' fill='white'%3E%F0%9F%8E%99%EF%B8%8F%3C/text%3E%3Ctext x='150' y='115' font-size='13' font-weight='bold' text-anchor='middle' fill='rgba(255,255,255,0.9)' font-family='sans-serif'%3EKling 3.0 Omni%3C/text%3E%3C/svg%3E" },
  { id: "kling26",  name: "Kling 2.6",           provider: "kling",   badge: "",     desc: "映像・音声・雰囲気を統合",           quality: 4, speed: 4, thumb: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='169'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%237C3AED'/%3E%3Cstop offset='1' stop-color='%234C1D95'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='300' height='169' fill='url(%23g)'/%3E%3Ctext x='150' y='80' font-size='28' text-anchor='middle' fill='white'%3E%F0%9F%8E%A5%3C/text%3E%3Ctext x='150' y='115' font-size='13' font-weight='bold' text-anchor='middle' fill='rgba(255,255,255,0.9)' font-family='sans-serif'%3EKling 2.6%3C/text%3E%3C/svg%3E" },
  { id: "kling25t", name: "Kling 2.5 Turbo",    provider: "kling",   badge: "",     desc: "プロ映像生成・高速版",               quality: 4, speed: 5, thumb: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='169'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23A855F7'/%3E%3Cstop offset='1' stop-color='%236D28D9'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='300' height='169' fill='url(%23g)'/%3E%3Ctext x='150' y='80' font-size='28' text-anchor='middle' fill='white'%3E%F0%9F%94%A5%3C/text%3E%3Ctext x='150' y='115' font-size='13' font-weight='bold' text-anchor='middle' fill='rgba(255,255,255,0.9)' font-family='sans-serif'%3EKling 2.5 Turbo%3C/text%3E%3C/svg%3E" },
  { id: "ltx2p",    name: "LTX-2 Pro",           provider: "ltx",     badge: "FAST", desc: "高速・軽量映像生成",                 quality: 3, speed: 5, thumb: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='169'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%2363B3ED'/%3E%3Cstop offset='1' stop-color='%232B6CB0'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='300' height='169' fill='url(%23g)'/%3E%3Ctext x='150' y='80' font-size='28' text-anchor='middle' fill='white'%3E%F0%9F%8C%80%3C/text%3E%3Ctext x='150' y='115' font-size='13' font-weight='bold' text-anchor='middle' fill='rgba(255,255,255,0.9)' font-family='sans-serif'%3ELTX-2 Pro%3C/text%3E%3C/svg%3E" },
];

const PROVIDER_COLORS = { kling:"#7C3AED", google:"#4285F4", openai:"#10A37F", runway:"#E53E3E", pixverse:"#F6AD55", ltx:"#63B3ED", minimax:"#059669" };
const PROVIDER_LABELS = { kling:"Kling", google:"Google", openai:"OpenAI", runway:"Runway", pixverse:"Pixverse", ltx:"LTX", minimax:"MiniMax" };

const BGMS = [
  { id: "ambient", label: "Minimalist Ambient", sub: "15秒 / ループ可能" },
  { id: "pop",     label: "Modern Pop Beat",    sub: "12秒 / アップテンポ" },
  { id: "jazz",    label: "Elegant Jazz",       sub: "20秒 / ループ可能" },
  { id: "epic",    label: "Epic Cinematic",     sub: "18秒 / ドラマティック" },
];
const VOICES = [
  { id: "naomi", label: "ナオミ (女)" },
  { id: "kenji", label: "ケンジ (男)" },
  { id: "yuki",  label: "ユキ (女)"  },
  { id: "ryo",   label: "リョウ (男)" },
];
const VARIATIONS = [
  { id: "luxury",  label: "ラグジュアリー", match: 98, recommended: true,  bg: "linear-gradient(160deg,#0d0a05,#2a1e08)", accent: "#C9A96E" },
  { id: "pop",     label: "ポップ",         match: 85, recommended: false, bg: "linear-gradient(160deg,#1a0030,#3d0060)", accent: "#FF5FA0" },
  { id: "minimal", label: "ミニマル",       match: 72, recommended: false, bg: "linear-gradient(160deg,#0a0a0f,#18181f)", accent: "#E8E8F0" },
];

/* Presets */
const SUBTITLE_PRESETS = ["Standard","All caps","Castor","Komika","Karaoke","Hormozi","One word","Word shake","Bold popping","Comic"];
const TRANSITION_PRESETS = ["Dynamic cut","Cinematic fade","Glitch roll","Stretch & zoom","Warp and cut","Pop & wobble","Zoom pop","Glide & slide","Wobble warp","Smooth blend","None"];
const OVERLAY_PRESETS = ["None","Bokeh particles","Light leaks","Oldfilm dust","Warm lightleaks","Cold lightleaks","Oldfilm scratches","Glamour & bokeh","Tech overlay","Golden particles"];
const FONTS = [
  { id: "noto",    label: "Noto Sans JP",   style: { fontFamily: "'Noto Sans JP', sans-serif", fontWeight: 700 } },
  { id: "mplus",   label: "M PLUS Rounded", style: { fontFamily: "'M PLUS Rounded 1c', sans-serif", fontWeight: 800 } },
  { id: "zen",     label: "Zen Dots",       style: { fontFamily: "'Zen Dots', cursive", fontWeight: 400 } },
  { id: "klee",    label: "Klee One",       style: { fontFamily: "'Klee One', cursive", fontWeight: 600 } },
  { id: "sawarabi",label: "Sawarabi Gothic",style: { fontFamily: "'Sawarabi Gothic', sans-serif", fontWeight: 400 } },
  { id: "bold",    label: "Impact",         style: { fontFamily: "Impact, sans-serif", fontWeight: 900 } },
  { id: "inter",   label: "Inter",          style: { fontFamily: "Inter, sans-serif", fontWeight: 700 } },
  { id: "playfair",label: "Playfair",       style: { fontFamily: "'Playfair Display', serif", fontWeight: 700 } },
];

const AI_STEPS = ["URLを解析中...","商品情報を抽出中...","コピーを生成中...","バリエーションを作成中...","プレビューを仕上げ中..."];
const COPY_CANDIDATES = [
  ["至高の一品があなたを待っている", "上質な素材と職人技が生み出す唯一無二の体験"],
  ["デザインが、あなたを語る",       "洗練されたスタイルで日常をもっと特別に"],
  ["妥協しない人のために作られた",   "細部まで追求した品質。それが私たちの約束"],
];

function readBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

async function callAI(url, templateLabel, apiKey, platform = "tiktok") {
  if (!apiKey) throw new Error("Claude APIキーが設定されていません。設定画面でAPIキーを入力してください。");

  // ─── Jina.ai Reader でページを取得（JS描画対応・文字化けなし）───
  let structuredContent = "";
  try {
    // Jina Reader: JSレンダリング対応、クリーンなMarkdownで返す、無料・APIキー不要
    const jinaUrl = `https://r.jina.ai/${url}`;
    const jinaRes = await fetch(jinaUrl, {
      headers: { "Accept": "text/plain", "X-Return-Format": "text" },
      signal: AbortSignal.timeout(15000),
    });
    if (jinaRes.ok) {
      const rawText = await jinaRes.text();
      // 画像マークダウン・不要記号を除去してテキストのみ残す
      const cleanText = rawText
        .replace(/!\[.*?\]\(.*?\)/g, "")   // 画像 ![...](...) を除去
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1") // リンク → テキストのみ
        .replace(/\n{3,}/g, "\n\n")         // 連続改行を整理
        .trim();
      // 先頭にTitleがあるので最初の8000字を使用
      structuredContent = cleanText.slice(0, 8000);
    }
  } catch (jinaErr) {
    // Jinaが失敗した場合は何もせずClaudeにURL推測させる
  }

  const PLATFORM_COPY_TONE = {
    tiktok:  "TikTok向け：バズる勢いのある短いフレーズ、Z世代に響くトレンド感、インパクト重視",
    reels:   "Instagram Reels向け：おしゃれで洗練されたライフスタイル表現、美的・憧れ感のある言葉",
    shorts:  "YouTube Shorts向け：明確な価値提案、分かりやすいベネフィット、幅広い層へ訴求",
    ec:      "EC商品ページ向け：具体的な仕様・機能、信頼性と購買意欲を高める表現",
  };
  const platformCopyCue = PLATFORM_COPY_TONE[platform] || PLATFORM_COPY_TONE.tiktok;
  const systemPrompt = `あなたは日本のECマーケティングと縦型SNS動画コピーの専門家です。
商品情報を正確に抽出し、視聴者の購買欲を刺激するSNS動画用コピーを生成します。
配信プラットフォーム：${platformCopyCue}
必ずJSONのみを返してください（マークダウン・コードブロック不要）。`;

  const userPrompt = structuredContent
    ? `以下はECページのテキスト内容です（Jina.ai Readerで取得したMarkdown形式）。
このページから商品情報を正確に抽出し、SNS縦型動画（テンプレート:${templateLabel}）用コピーをJSONのみで返してください。

【絶対守るルール】
・productName：ページに記載された正確な商品名をそのまま抽出（カタカナ化・略称禁止）
・price：ページに記載された実際の販売価格を正確に抽出（例: 740円、¥1,980）
・漢字・ひらがな・カタカナはページ記載のまま出力（「印」→「イン」など変換禁止）
・mainCopy：15字以内の強いSNS動画キャッチコピー
・subCopy：30字以内の具体的ベネフィット
・features：ページから読み取れる商品の具体的な特徴・仕様（3〜5点）
・ugcPoints：レビュー・口コミ・お客様の声から拾った実際の評価コメント（3点）※なければ空配列
・reviewSummary：レビューの全体傾向（1〜2文）※なければ空文字
・titleText：動画タイトルに使える10字以内のキャッチフレーズ

ECページ内容:
---
${structuredContent}
---

返却JSON（このJSONのみ出力、他のテキスト不要）:
{"productName":"","category":"","price":"","target":"","catchphrase":"","mainCopy":"","subCopy":"","titleText":"","features":[],"ugcPoints":[],"reviewSummary":"","recommendedBgm":0,"recommendedVoice":0}`
    : `あなたは日本のECマーケティング専門家です。URL「${url}」の商品をURLから推測し、SNS縦型動画（テンプレート:${templateLabel}）用のコピーをJSONのみで返してください。
{"productName":"","category":"","price":"","target":"","catchphrase":"","mainCopy":"","subCopy":"","titleText":"","features":[],"ugcPoints":[],"reviewSummary":"","recommendedBgm":0,"recommendedVoice":0}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `API error: ${res.status}`);
  }
  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text || "{}";
  try {
    const jsonStr = text.replace(/```json|```/g, "").trim();
    const match = jsonStr.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : jsonStr);
  } catch {
    return { productName: "", category: "", catchphrase: text.slice(0, 100), mainCopy: "", subCopy: "", features: [], ugcPoints: [] };
  }
}

/* ── Stars ── */
const Stars = ({ n, max = 5 }) => (
  <div style={{ display: "flex", gap: 1 }}>
    {Array.from({ length: max }).map((_, i) => (
      <div key={i} style={{ width: 6, height: 6, borderRadius: 1, background: i < n ? "#f06a28" : "#333" }} />
    ))}
  </div>
);

/* ── Shared: Sidebar ── */
const HelpModal = ({ onClose }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, width: 520, maxHeight: "80vh", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "24px 28px 20px", borderBottom: "1px solid #EEF0F4", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, background: "#EFF6FF", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#4F6EF7"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, color: "#1A202C" }}>ヘルプ・使い方</span>
        </div>
        <button onClick={onClose} style={{ background: "#F4F6F9", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, color: "#64748B" }}>×</button>
      </div>
      <div style={{ overflowY: "auto", padding: "20px 28px 28px" }}>
        {[
          { step: "1", title: "テンプレートを選ぶ", desc: "動画の目的に合わせてテンプレートを選択します。セール告知・製品紹介・Tipsなど10種類以上から選べます。", icon: "🎨" },
          { step: "2", title: "商品情報を設定", desc: "商品URLを入力するとAIが自動で商品情報を解析します。または直接画像をアップロードして手動でプロンプトを入力することもできます。", icon: "🔗" },
          { step: "3", title: "AIで動画を生成", desc: "「書き出し」ボタンを押すとFAL.ai経由でAI動画が生成されます。事前にAPIキー（🔑）の設定が必要です。生成には1〜5分かかります。", icon: "🎬" },
          { step: "4", title: "FAL.ai APIキーの設定", desc: "fal.ai でアカウントを作成し、Settingsページ → API Keys でキーを取得します。右上の🔑ボタンから入力してください。", icon: "🔑" },
        ].map(item => (
          <div key={item.step} style={{ display: "flex", gap: 16, marginBottom: 20, padding: "16px", background: "#F8F9FB", borderRadius: 12 }}>
            <div style={{ width: 40, height: 40, background: "#fff", borderRadius: 10, border: "1px solid #EEF0F4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{item.icon}</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 800, background: "#f06a28", color: "#fff", borderRadius: 99, padding: "1px 7px" }}>STEP {item.step}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1A202C" }}>{item.title}</span>
              </div>
              <p style={{ fontSize: 12.5, color: "#64748B", margin: 0, lineHeight: 1.7 }}>{item.desc}</p>
            </div>
          </div>
        ))}
        <div style={{ background: "#FFF3EE", borderRadius: 12, padding: "14px 18px", border: "1px solid #FED7AA" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#C2410C", marginBottom: 4 }}>💡 よくある質問</div>
          <div style={{ fontSize: 12.5, color: "#64748B", lineHeight: 1.7 }}>
            <b>Q: 動画が生成されない</b> → FAL.aiのAPIキーとクレジット残高を確認してください<br/>
            <b>Q: URLを解析できない</b> → 一部のサイトはアクセス制限があります。直接テキスト入力をお試しください<br/>
            <b>Q: 生成に時間がかかる</b> → AIモデルにより1〜8分かかります。画面を閉じずにお待ちください
          </div>
        </div>
      </div>
    </div>
  </div>
);

const UpgradeModal = ({ onClose }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, width: 480, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.3)" }}>
      <div style={{ background: "linear-gradient(135deg, #667eea, #764ba2)", padding: "32px 36px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 22 }}>⭐</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>ShortGen Pro</span>
            </div>
            <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.8)", margin: 0 }}>AI動画生成を無制限に。月額2,000円（税込）</p>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff", fontSize: 18 }}>×</button>
        </div>
        <div style={{ marginTop: 20, background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "14px 20px" }}>
          <span style={{ fontSize: 36, fontWeight: 900, color: "#fff" }}>¥2,000</span>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.75)" }}> / 月（税込）</span>
        </div>
      </div>
      <div style={{ padding: "24px 36px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
          {[
            ["🎬", "動画生成 無制限", "月50本まで制限なし"],
            ["🤖", "全AIモデル使用可", "Kling 3.0・VEO含む"],
            ["☁️", "クラウド保存", "プロジェクト無制限保存"],
            ["⚡", "優先処理", "生成キュー最優先"],
            ["📊", "詳細分析", "動画パフォーマンス分析"],
            ["🎨", "カスタムブランド", "ロゴ・フォント設定"],
          ].map(([icon, title, desc]) => (
            <div key={title} style={{ display: "flex", gap: 10, padding: "10px 12px", background: "#F8F9FB", borderRadius: 10 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1A202C" }}>{title}</div>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => { alert("Stripe決済ページに遷移します（実装予定）"); onClose(); }}
          style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg, #667eea, #764ba2)", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 16px rgba(102,126,234,0.4)", letterSpacing: "0.02em" }}
        >
          今すぐアップグレード → ¥2,000/月
        </button>
        <p style={{ fontSize: 11, color: "#94A3B8", textAlign: "center", marginTop: 10 }}>いつでもキャンセル可能・翌月から適用</p>
      </div>
    </div>
  </div>
);

const Sidebar = ({ step, navPage, setNavPage, onCreateNew, userName, userPhoto, onLogout }) => {
  const [showUpgrade, setShowUpgrade] = useState(false);

  const mainNav = [
    { id: "home",      icon: "smart_display", label: "Home" },
    { id: "templates", icon: "grid",          label: "Templates" },
    { id: "projects",  icon: "layers",        label: "Projects" },
    { id: "assets",    icon: "image",         label: "Assets" },
  ];

  const bottomNav = [
    { id: "settings", icon: "tune", label: "Settings" },
  ];

  const navItemStyle = (isActive) => ({
    display: "flex", alignItems: "center", gap: 10,
    padding: "8px 12px", borderRadius: 8, marginBottom: 2,
    background: isActive ? "#EEF2FF" : "transparent",
    cursor: "pointer",
    transition: "background 0.15s",
  });

  const navIconColor = (isActive) => isActive ? "#4F6EF7" : "#94A3B8";
  const navLabelStyle = (isActive) => ({
    fontSize: 13.5, fontWeight: isActive ? 600 : 400,
    color: isActive ? "#3B55E6" : "#4A5568",
    letterSpacing: "-0.01em",
  });

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      borderRight: "1px solid #EEF0F4",
      background: "#F8F9FB",
      display: "flex", flexDirection: "column",
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* ── ロゴ ── */}
      <div style={{ padding: "20px 16px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 34, height: 34,
          background: "linear-gradient(135deg, #f06a28 0%, #e8420a 100%)",
          borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 8px rgba(240,106,40,0.35)",
        }}>
          <Icon name="bolt" size={17} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111", lineHeight: 1.2, letterSpacing: "-0.02em" }}>ShortGen AI</div>
          <div style={{ fontSize: 10, color: "#94A3B8", letterSpacing: "0.02em" }}>Video Generation</div>
        </div>
      </div>

      {/* ── メインナビ ── */}
      <nav style={{ padding: "4px 8px", flex: 1 }}>
        {mainNav.map((item) => {
          const activeId = navPage === "home" ? "home" : navPage === "editor" ? "templates" : navPage === "projects" ? "projects" : navPage === "assets" ? "assets" : navPage === "settings" ? "settings" : (navPage || "home");
          const isActive = item.id === activeId;
          return (
            <div key={item.id}
              style={navItemStyle(isActive)}
              onClick={() => { if(item.id==="home") setNavPage("home"); else if(item.id==="templates"){ setNavPage("editor"); } else if(item.id==="projects") setNavPage("projects"); else if(item.id==="assets") setNavPage("assets"); else setNavPage(item.id); }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#F1F3F7"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              <Icon name={item.icon} size={16} color={navIconColor(isActive)} />
              <span style={navLabelStyle(isActive)}>{item.label}</span>
            </div>
          );
        })}

        {/* ── 区切り線 ── */}
        <div style={{ height: 1, background: "#E8EAF0", margin: "10px 4px" }} />

        {bottomNav.map((item) => {
          const isActive2 = (navPage || "home") === item.id;
          return (
            <div key={item.id}
              style={navItemStyle(isActive2)}
              onClick={() => setNavPage(item.id)}
              onMouseEnter={e => { if (!isActive2) e.currentTarget.style.background = "#F1F3F7"; }}
              onMouseLeave={e => { if (!isActive2) e.currentTarget.style.background = "transparent"; }}
            >
              <Icon name={item.icon} size={16} color={navIconColor(isActive2)} />
              <span style={navLabelStyle(isActive2)}>{item.label}</span>
            </div>
          );
        })}
      </nav>

      {/* 新規作成ボタン */}
      <div style={{ padding: "0 10px 12px" }}>
        <button onClick={onCreateNew} style={{ width: "100%", padding: "10px", background: "linear-gradient(135deg, #f06a28, #e8420a)", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 3px 10px rgba(240,106,40,0.35)" }}>
          <Icon name="add" size={16} color="#fff" /> 新規作成
        </button>
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
      {/* ── アップグレードバナー（Pro未満向け） ── */}
      <div onClick={() => setShowUpgrade(true)} style={{
        margin: "0 10px 12px",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        borderRadius: 10, padding: "12px 14px",
        cursor: "pointer",
        transition: "opacity 0.15s",
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
      onMouseLeave={e => e.currentTarget.style.opacity = "1"}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
          <Icon name="star" size={13} color="#FFD700" />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.03em" }}>Upgrade to Pro</span>
        </div>
        <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.82)", margin: 0, lineHeight: 1.5 }}>
          Unlimited generations &amp; premium AI models
        </p>
        <div style={{
          marginTop: 9, background: "rgba(255,255,255,0.22)",
          borderRadius: 6, padding: "5px 10px", textAlign: "center",
          fontSize: 11, fontWeight: 700, color: "#fff",
        }}>
          Get Pro →
        </div>
      </div>

      {/* ── ユーザー情報 ── */}
      <div style={{
        padding: "12px 14px",
        borderTop: "1px solid #EEF0F4",
        display: "flex", alignItems: "center", gap: 10,
        cursor: "pointer",
      }}
        onMouseEnter={e => e.currentTarget.style.background = "#F1F3F7"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "linear-gradient(135deg, #4F6EF7, #7C3AED)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0,
          overflow: "hidden",
        }}>
          {userPhoto
            ? <img src={userPhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : (userName || "U").charAt(0).toUpperCase()
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1A202C", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {userName || "Username"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
            <span style={{
              fontSize: 9.5, fontWeight: 700, color: "#4F6EF7",
              background: "#EEF2FF", borderRadius: 4, padding: "1px 6px",
              letterSpacing: "0.03em",
            }}>
              Pro Plan
            </span>
          </div>
          {onLogout && (
            <button onClick={onLogout} title="ログアウト" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#94A3B8", borderRadius: 6, display: "flex", alignItems: "center", flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.color = "#EF4444"}
              onMouseLeave={e => e.currentTarget.style.color = "#94A3B8"}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

/* ── Shared: Stepper ── */
const Stepper = ({ step, onNext, nextLabel, onBack, showBack, onSave, extra }) => (
  <header style={{ height: 52, borderBottom: "1px solid #e8e8e8", background: "#fff", padding: "0 22px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      {[1,2,3].map((s, i) => {
        const labels = ["Select Template","Platform & Content","AI Video Editor"];
        const done = s < step, active = s === step;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, opacity: active ? 1 : done ? 0.85 : 0.3 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: done||active ? "#f06a28" : "#ddd", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
                {done ? <Icon name="check" size={11} color="#fff" /> : s}
              </div>
              <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? "#111" : "#aaa" }}>{labels[i]}</span>
            </div>
            {i < 2 && <div style={{ width: 24, height: 1, background: "#e0e0e0" }} />}
          </div>
        );
      })}
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      {extra}
      {showBack && (
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 11px", borderRadius: 6, border: "1px solid #e0e0e0", background: "#fff", fontSize: 12, fontWeight: 600, color: "#555", cursor: "pointer" }}>
          <Icon name="arrow_back" size={12} color="#666" />戻る
        </button>
      )}
      {onSave && <button onClick={onSave} style={{ padding: "5px 11px", borderRadius: 6, border: "1px solid #e0e0e0", background: "#fff", fontSize: 12, fontWeight: 600, color: "#555", cursor: "pointer" }}>下書き保存</button>}
      {onNext && <button onClick={onNext} style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: "#f06a28", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 7px rgba(240,106,40,0.28)" }}>{nextLabel||"次へ進む"}</button>}
    </div>
  </header>
);

/* ═══════════════
   STEP 1
   ═══════════════ */
const Step1 = ({ selected, onSelect, onNext }) => {
  const [cat, setCat] = useState("すべて");
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sg_fav_templates") || "[]"); } catch { return []; }
  });
  const toggleFav = (id, e) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      localStorage.setItem("sg_fav_templates", JSON.stringify(next));
      return next;
    });
  };
  const allCats = ["すべて", "お気に入り", ...CATEGORIES.filter(c => c !== "すべて")];
  const filtered = cat === "お気に入り"
    ? TEMPLATES.filter(t => favorites.includes(t.id))
    : cat === "すべて" ? TEMPLATES : TEMPLATES.filter(t => t.category === cat);
  const tmpl = TEMPLATES.find(t => t.id === selected);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <Stepper step={1} onNext={() => selected && onNext()} nextLabel="次へ進む" />
      <div style={{ flex: 1, overflowY: "auto", background: "#fafafa", padding: "22px 26px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 3 }}>Select a Template</h2>
          <p style={{ fontSize: 13, color: "#aaa", marginBottom: 20 }}>動画の目的に最適なスタイルを選んで生成を開始しましょう。</p>
          <div style={{ display: "flex", borderBottom: "1px solid #e8e8e8", marginBottom: 20, gap: 20 }}>
            {allCats.map(c => (
              <button key={c} onClick={() => setCat(c)} style={{ padding: "0 0 9px", border: "none", borderBottom: `2px solid ${cat===c?"#f06a28":"transparent"}`, background: "transparent", fontSize: 13, fontWeight: cat===c?700:500, color: cat===c?"#f06a28":"#aaa", cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
                {c === "お気に入り" && <span style={{ fontSize: 11 }}>⭐</span>}
                {c}
                {c === "お気に入り" && favorites.length > 0 && <span style={{ fontSize: 10, background: "#f06a28", color: "#fff", borderRadius: 9, padding: "1px 5px", fontWeight: 700 }}>{favorites.length}</span>}
              </button>
            ))}
          </div>
          {cat === "お気に入り" && filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#ccc" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⭐</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>お気に入りがまだありません</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>テンプレートカードの ⭐ を押してお気に入りに追加できます</div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
            {filtered.map(t => {
              const sel = selected === t.id;
              const isFav = favorites.includes(t.id);
              return (
                <div key={t.id} onClick={() => onSelect(t.id)} style={{ background: "#fff", borderRadius: 11, overflow: "hidden", border: `2px solid ${sel?"#f06a28":"#eaeaea"}`, boxShadow: sel?"0 0 0 3px rgba(240,106,40,0.1)":"0 1px 3px rgba(0,0,0,0.05)", cursor: "pointer", transition: "all 0.14s" }}>
                  <div style={{ aspectRatio: "16/9", position: "relative", overflow: "hidden", background: "#f0f0f0" }}>
                    <img src={t.thumb} alt={t.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{ position: "absolute", bottom: 6, left: 7, display: "flex", gap: 4 }}>
                      {t.platforms.map(p => <span key={p} style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 3, background: "rgba(0,0,0,0.55)", color: "#fff" }}>{PLATFORM_LABELS[p]}</span>)}
                    </div>
                    {sel && <div style={{ position: "absolute", top: 7, right: 28, width: 21, height: 21, background: "#f06a28", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="check" size={11} color="#fff" /></div>}
                    <button onClick={(e) => toggleFav(t.id, e)} style={{ position: "absolute", top: 5, right: 5, background: "rgba(0,0,0,0.4)", border: "none", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 12, lineHeight: 1, backdropFilter: "blur(4px)", transition: "background 0.15s" }} title={isFav ? "お気に入りから削除" : "お気に入りに追加"}>
                      {isFav ? "⭐" : "☆"}
                    </button>
                  </div>
                  <div style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{t.label}</div>
                      {t.popular && <span style={{ fontSize: 9, background: "#f06a28", color: "#fff", padding: "2px 5px", borderRadius: 3, fontWeight: 700 }}>POPULAR</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "#bbb" }}>{t.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <footer style={{ height: 44, background: "#fff", borderTop: "1px solid #f0f0f0", padding: "0 26px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <Icon name="palette" size={13} color={tmpl ? "#f06a28" : "#ccc"} />
        <span style={{ fontSize: 11, color: "#bbb", fontWeight: 600 }}>選択中：</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>{tmpl ? tmpl.label : "未選択"}</span>
        {tmpl && <div style={{ display: "flex", gap: 4 }}>{tmpl.platforms.map(p => <span key={p} style={{ fontSize: 9, padding: "2px 5px", borderRadius: 3, background: "#fff3ee", color: "#f06a28", fontWeight: 700 }}>{PLATFORM_LABELS[p]}</span>)}</div>}
        <span style={{ fontSize: 11, color: "#ccc", marginLeft: "auto" }}>推定生成時間: <strong style={{ color: "#999" }}>約 2分</strong></span>
      </footer>
    </div>
  );
};

/* ── 画像アップロードパネル（ドラッグ＆ドロップ・URL追加対応）── */
const ImageUploadPanel = ({ label, subLabel, images, setImages, accentColor, accentBg, accentBorder, icon, aspectRatio, addImgs, allowReorder }) => {
  const fileRef = useRef();
  const [dragOver, setDragOver] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [urlInput, setUrlInput] = useState("");
  const [urlTab, setUrlTab] = useState("file"); // "file" | "url"
  const [urlErr, setUrlErr] = useState("");

  const handleAddUrl = () => {
    const u = urlInput.trim();
    if (!u.startsWith("http")) { setUrlErr("http/https URLを入力してください"); return; }
    setUrlErr("");
    setImages(p => [...p, { url: u, id: Date.now(), name: u.split("/").pop() }].slice(0, 6));
    setUrlInput("");
  };

  const moveImg = (from, to) => {
    setImages(prev => { const a=[...prev]; const [it]=a.splice(from,1); a.splice(to,0,it); return a; });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>
          {label} <span style={{ fontSize: 10, color: "#aaa", fontWeight: 400 }}>{subLabel}</span>
        </label>
        {/* ファイル/URLタブ */}
        <div style={{ display: "flex", background: "#f5f5f5", borderRadius: 6, padding: 2, gap: 1 }}>
          {[["file","📁 ファイル"],["url","🔗 URL"]].map(([id, lbl]) => (
            <button key={id} onClick={() => setUrlTab(id)} style={{ padding: "3px 9px", borderRadius: 4, border: "none", background: urlTab===id?"#fff":"transparent", color: urlTab===id?"#111":"#999", fontSize: 10, fontWeight: 600, cursor: "pointer", boxShadow: urlTab===id?"0 1px 3px rgba(0,0,0,0.08)":"none", transition: "all 0.12s" }}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* URLタブ */}
      {urlTab === "url" && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 5, padding: "7px 10px", background: "#fafafa", border: `1px solid ${urlErr?"#f44336":"#e0e0e0"}`, borderRadius: 7 }}>
              <Icon name="link" size={12} color="#ccc" />
              <input value={urlInput} onChange={e=>{setUrlInput(e.target.value);setUrlErr("");}} onKeyDown={e=>e.key==="Enter"&&handleAddUrl()} placeholder="https://example.com/image.jpg" style={{ flex:1, border:"none", outline:"none", fontSize:12, color:"#333", background:"transparent", fontFamily:"inherit" }} />
            </div>
            <button onClick={handleAddUrl} style={{ padding: "7px 12px", borderRadius: 7, border: "none", background: accentColor, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>追加</button>
          </div>
          {urlErr && <p style={{ fontSize: 10, color: "#f44336", marginTop: 3 }}>{urlErr}</p>}
        </div>
      )}

      {images.length === 0 ? (
        <div
          onClick={() => urlTab==="file" && fileRef.current?.click()}
          onDrop={e=>{e.preventDefault();setDragOver(false);addImgs(e.dataTransfer.files,setImages);}}
          onDragOver={e=>{e.preventDefault();setDragOver(true);}}
          onDragLeave={()=>setDragOver(false)}
          style={{ border: `2px dashed ${dragOver?accentColor:"#ddd"}`, borderRadius: 9, padding: "22px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: urlTab==="file"?"pointer":"default", background: dragOver?accentBg:"#fafafa", transition: "all 0.14s" }}
        >
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => addImgs(e.target.files, setImages)} />
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: accentBg, border: `1px solid ${accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={17} color={accentColor} /></div>
          <p style={{ fontSize: 11, fontWeight: 500, color: "#777" }}>ドラッグ＆ドロップ</p>
          <p style={{ fontSize: 10, color: "#ccc" }}>またはクリックして選択 / JPG・PNG・WEBP</p>
        </div>
      ) : (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 5 }}>
            {images.map((img, i) => (
              <div key={img.id}
                draggable={!!allowReorder}
                onDragStart={()=>allowReorder&&setDragIdx(i)}
                onDragOver={e=>{e.preventDefault();allowReorder&&setDragOverIdx(i);}}
                onDrop={e=>{e.preventDefault();if(allowReorder&&dragIdx!==null&&dragIdx!==i)moveImg(dragIdx,i);setDragIdx(null);setDragOverIdx(null);}}
                onDragEnd={()=>{setDragIdx(null);setDragOverIdx(null);}}
                style={{ borderRadius: 7, overflow: "hidden", position: "relative", border: `2px solid ${i===0?accentColor:dragOverIdx===i?accentColor:"#eaeaea"}`, cursor: allowReorder?"grab":"default", opacity: dragIdx===i?0.45:1, transition: "border-color 0.12s" }}
              >
                <img src={img.url} alt="" style={{ width: "100%", aspectRatio, objectFit: "cover", display: "block" }} />
                <button onClick={()=>setImages(p=>p.filter(x=>x.id!==img.id))} style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: "50%", background: "rgba(0,0,0,0.65)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={9} color="#fff" /></button>
                {i===0 && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: accentColor, color: "#fff", fontSize: 8, fontWeight: 700, textAlign: "center", padding: "1px 0" }}>MAIN</div>}
              </div>
            ))}
            {images.length < 6 && (
              <div
                onClick={()=>urlTab==="file"&&fileRef.current?.click()}
                onDrop={e=>{e.preventDefault();addImgs(e.dataTransfer.files,setImages);}}
                onDragOver={e=>e.preventDefault()}
                style={{ border: "2px dashed #e0e0e0", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", aspectRatio, cursor: "pointer", background: "#fafafa" }}
              >
                <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e=>addImgs(e.target.files,setImages)} />
                <Icon name="add" size={18} color="#ccc" />
              </div>
            )}
          </div>
          {allowReorder && images.length > 1 && <p style={{ fontSize: 9, color: "#ccc", marginTop: 3 }}>ドラッグで順番変更・1枚目がメイン</p>}
        </div>
      )}
    </div>
  );
};

/* ═══════════════
   STEP 2
   ═══════════════ */
const Step2 = ({ platform, setPlatform, url, setUrl, images, setImages, onNext, onBack, product, setProduct, analyzing, onAnalyze, urlErr, prompt, setPrompt, showPrompt, setShowPrompt, aiModel, setAiModel, modelImages, setModelImages, onGenerateCopy, copyGenerating, copies }) => {
  const fileRef = useRef();
  const modelFileRef = useRef();
  const [dragOver, setDragOver] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [modelTab, setModelTab] = useState("all");
  const [showModels, setShowModels] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const handleGenerateCopyWithFeedback = async () => {
    setCopyDone(false);
    await onGenerateCopy();
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 4000);
  };
  const [savedPrompts, setSavedPrompts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sg_saved_prompts") || "[]"); } catch { return []; }
  });
  const [showSavedPrompts, setShowSavedPrompts] = useState(false);

  const saveCurrentPrompt = () => {
    if (!prompt.trim()) return;
    const next = [{ id: Date.now(), text: prompt.trim(), date: new Date().toLocaleDateString("ja-JP") }, ...savedPrompts].slice(0, 10);
    setSavedPrompts(next);
    localStorage.setItem("sg_saved_prompts", JSON.stringify(next));
  };
  const deletePrompt = (id) => {
    const next = savedPrompts.filter(p => p.id !== id);
    setSavedPrompts(next);
    localStorage.setItem("sg_saved_prompts", JSON.stringify(next));
  };

  const filteredModels = modelTab === "all" ? AI_MODELS : AI_MODELS.filter(m => m.provider === modelTab);
  const selectedModel = AI_MODELS.find(m => m.id === aiModel);

  const addImgs = useCallback(async (files, setter) => {
    const filtered = Array.from(files).filter(f => f.type.startsWith("image/")).slice(0, 6);
    const newImgs = await Promise.all(filtered.map(async (f, i) => ({ url: await readBase64(f), id: Date.now()+i, name: f.name })));
    setter(p => [...p, ...newImgs].slice(0, 6));
    // アップロード画像をアセットに自動保存
    try {
      const existing = JSON.parse(localStorage.getItem("sg_visual_assets") || "[]");
      const toAdd = newImgs.map(img => ({ id: img.id, name: img.name, type: "image", dataUrl: img.url, isGenerated: false, date: new Date().toLocaleDateString("ja-JP") }));
      localStorage.setItem("sg_visual_assets", JSON.stringify([...toAdd, ...existing]));
    } catch {}
  }, []);

  const moveImg = (from, to) => {
    setImages(prev => { const a=[...prev]; const [it]=a.splice(from,1); a.splice(to,0,it); return a; });
  };

  const canNext = !!(product || images.length > 0 || modelImages.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <Stepper step={2} onNext={() => canNext && onNext()} nextLabel="次へ進む" onBack={onBack} showBack />
      <div style={{ flex: 1, overflowY: "auto", background: "#fafafa", padding: "22px 26px" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 3 }}>Platform & Content Settings</h2>
          <p style={{ fontSize: 13, color: "#aaa", marginBottom: 20 }}>配信先・AIモデル・素材を設定してください。</p>

          {/* Platform */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 11, marginBottom: 22 }}>
            {PLATFORMS.map(p => {
              const sel = platform === p.id;
              return (
                <button key={p.id} onClick={() => setPlatform(p.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "15px 10px", background: "#fff", border: `2px solid ${sel?"#f06a28":"#eaeaea"}`, borderRadius: 11, cursor: "pointer", position: "relative", transition: "all 0.14s", boxShadow: sel?"0 0 0 3px rgba(240,106,40,0.09)":"none" }}>
                  {sel && <div style={{ position: "absolute", top: 8, right: 8 }}><Icon name="check_circle" size={15} color="#f06a28" /></div>}
                  <div style={{ marginBottom: 8 }}><div style={{ width: p.ratio==="1:1"?30:20, height: p.ratio==="1:1"?30:40, border: `2px solid ${sel?"#f06a28":"#ccc"}`, borderRadius: 3, opacity: sel?1:0.4 }} /></div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#111", marginBottom: 1 }}>{p.label}</div>
                  <div style={{ fontSize: 9, color: "#bbb", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{p.ratioLabel}</div>
                </button>
              );
            })}
          </div>

          {/* ── AI Model Selection ── */}
          <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, marginBottom: 18, overflow: "hidden" }}>
            <button onClick={() => setShowModels(p=>!p)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: "#fff3ee", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="video_cam" size={15} color="#f06a28" />
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>AIビデオモデルを選択</div>
                  {selectedModel && <div style={{ fontSize: 11, color: "#aaa", marginTop: 1 }}>{selectedModel.name} — {selectedModel.desc}</div>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {selectedModel && (
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "#fff3ee", color: "#f06a28", fontWeight: 700 }}>{selectedModel.name}</span>
                )}
                <Icon name={showModels?"collapse":"expand"} size={17} color="#bbb" />
              </div>
            </button>

            {showModels && (
              <div style={{ borderTop: "1px solid #f0f0f0", padding: "14px 16px" }}>
                {/* Provider Tabs */}
                <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                  {[["all","すべて"], ["kling","Kling"], ["minimax","MiniMax"], ["google","Google"], ["openai","OpenAI"], ["runway","Runway"], ["pixverse","Pixverse"]].map(([id, label]) => (
                    <button key={id} onClick={() => setModelTab(id)} style={{ padding: "4px 12px", borderRadius: 20, border: "none", background: modelTab===id?"#f06a28":"#f5f5f5", color: modelTab===id?"#fff":"#777", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.12s" }}>{label}</button>
                  ))}
                </div>
                {/* Model Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, maxHeight: 340, overflowY: "auto" }}>
                  {filteredModels.map(m => {
                    const sel = aiModel === m.id;
                    return (
                      <div key={m.id} onClick={() => { setAiModel(m.id); setShowModels(false); }}
                        style={{ borderRadius: 9, overflow: "hidden", border: `2px solid ${sel?"#f06a28":"#eaeaea"}`, cursor: "pointer", transition: "all 0.13s", boxShadow: sel?"0 0 0 3px rgba(240,106,40,0.1)":"none" }}>
                        <div style={{ aspectRatio: "16/9", position: "relative", overflow: "hidden", background: "#1a1a1a" }}>
                          <img src={m.thumb} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.65 }} />
                          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.75) 100%)" }} />
                          {m.badge && <span style={{ position: "absolute", top: 5, left: 5, fontSize: 8, background: m.badge==="FAST"?"#10B981":m.badge==="HOT"?"#EF4444":"#7C3AED", color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>{m.badge}</span>}
                          {sel && <div style={{ position: "absolute", top: 5, right: 5, width: 18, height: 18, background: "#f06a28", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="check" size={10} color="#fff" /></div>}
                          <span style={{ position: "absolute", bottom: 5, left: 5, fontSize: 8, background: PROVIDER_COLORS[m.provider]+"cc", color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>{PROVIDER_LABELS[m.provider]}</span>
                        </div>
                        <div style={{ padding: "8px 9px", background: sel?"#fff8f5":"#fafafa" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: sel?"#f06a28":"#111", marginBottom: 3 }}>{m.name}</div>
                          <div style={{ fontSize: 9, color: "#bbb", marginBottom: 5, lineHeight: 1.4 }}>{m.desc}</div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <div>
                              <div style={{ fontSize: 8, color: "#ccc", marginBottom: 2 }}>品質</div>
                              <Stars n={m.quality} />
                            </div>
                            <div>
                              <div style={{ fontSize: 8, color: "#ccc", marginBottom: 2 }}>速度</div>
                              <Stars n={m.speed} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Photo to Video ── */}
          <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, marginBottom: 18, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: "#f0fff4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="image" size={15} color="#22C55E" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>素材画像 / Photo to Video</div>
                <div style={{ fontSize: 11, color: "#aaa" }}>画像をアップロードまたはURLで追加。AIが動画化します</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Model Images */}
              <ImageUploadPanel
                label="モデル画像"
                subLabel="（人物・ポーズ）"
                images={modelImages}
                setImages={setModelImages}
                accentColor="#22C55E"
                accentBg="#f0fff4"
                accentBorder="#d1fae5"
                icon="person"
                aspectRatio="3/4"
                addImgs={addImgs}
              />
              {/* Product Images */}
              <ImageUploadPanel
                label="商品画像"
                subLabel="（素材・商品）"
                images={images}
                setImages={setImages}
                accentColor="#f06a28"
                accentBg="#fff3ee"
                accentBorder="#ffd0b8"
                icon="add_photo"
                aspectRatio="1/1"
                addImgs={addImgs}
                allowReorder
              />
            </div>
          </div>

          {/* URL */}
          <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 8 }}>商品ページURL（オプション）</label>
            <div style={{ display: "flex", gap: 7 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", background: "#fafafa", border: `1px solid ${urlErr?"#f44336":"#e0e0e0"}`, borderRadius: 8 }}>
                <Icon name="link" size={13} color="#ccc" />
                <input value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onAnalyze()} placeholder="https://www.amazon.co.jp/dp/..." style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: "#333", background: "transparent", fontFamily: "inherit" }} />
                {url && <button onClick={()=>setUrl("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><Icon name="close" size={12} color="#ccc" /></button>}
              </div>
              <button onClick={onAnalyze} disabled={analyzing||!url.trim()} style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 13px", borderRadius: 8, border: "none", background: analyzing||!url.trim()?"#e0e0e0":"#f06a28", color: "#fff", fontSize: 12, fontWeight: 700, cursor: analyzing||!url.trim()?"not-allowed":"pointer", whiteSpace: "nowrap" }}>
                <Icon name="auto_awesome" size={12} color="#fff" />{analyzing?"解析中...":"AI分析"}
              </button>
            </div>
            {urlErr && <p style={{ fontSize: 11, color: "#f44336", marginTop: 4 }}>{urlErr}</p>}
            {product && (
              <div style={{ marginTop: 10, background: "#fff8f5", border: "1px solid #ffd0b8", borderRadius: 8, padding: 11 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Icon name="check_circle" size={13} color="#f06a28" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#f06a28" }}>商品情報を取得しました</span>
                  </div>
                  <button onClick={handleGenerateCopyWithFeedback} disabled={copyGenerating} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 6, border: "none", background: copyGenerating ? "#e0e0e0" : copyDone ? "#16A34A" : "#7C3AED", color: "#fff", fontSize: 11, fontWeight: 700, cursor: copyGenerating ? "not-allowed" : "pointer", transition: "background 0.3s" }}>
                    <Icon name={copyDone ? "check_circle" : "auto_awesome"} size={11} color="#fff" />
                    {copyGenerating ? "生成中..." : copyDone ? "生成完了！次のステップへ↓" : "AIコピーを生成"}
                  </button>
                </div>
                {/* 基本情報（クリックして直接編集可能） */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
                  {[["商品名","productName"],["カテゴリ","category"],["価格","price"],["ターゲット","target"]].map(([label, key])=>(
                    <div key={key} style={{ background: "#fff", borderRadius: 5, padding: "5px 7px", border: "1px solid transparent", transition: "border 0.15s" }} title="クリックして編集">
                      <div style={{ fontSize: 9, color: "#ccc", fontWeight: 700, marginBottom: 1 }}>{label} <span style={{ fontSize: 8, color: "#f06a28" }}>✎</span></div>
                      <input
                        value={product[key] || ""}
                        onChange={e => setProduct && setProduct({ ...product, [key]: e.target.value })}
                        style={{ width: "100%", fontSize: 11, fontWeight: 700, color: "#111", border: "none", background: "transparent", outline: "none", padding: 0, fontFamily: "inherit", cursor: "text" }}
                        placeholder="—"
                      />
                    </div>
                  ))}
                </div>
                {/* 商品特徴 */}
                {product.features && product.features.length > 0 && (
                  <div style={{ marginBottom: 7 }}>
                    <div style={{ fontSize: 10, color: "#f06a28", fontWeight: 700, marginBottom: 4 }}>📌 商品特徴</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {product.features.map((f, i) => (
                        <span key={i} style={{ fontSize: 10, background: "#fff3ee", color: "#c04a0a", borderRadius: 4, padding: "2px 7px", border: "1px solid #ffd0b8", fontWeight: 600 }}>{f}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* 口コミ・UGC */}
                {product.ugcPoints && product.ugcPoints.length > 0 && (
                  <div style={{ marginBottom: 7 }}>
                    <div style={{ fontSize: 10, color: "#7C3AED", fontWeight: 700, marginBottom: 4 }}>💬 顧客の声・口コミ</div>
                    {product.ugcPoints.map((u, i) => (
                      <div key={i} style={{ fontSize: 11, color: "#333", background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 5, padding: "4px 8px", marginBottom: 3 }}>「{u}」</div>
                    ))}
                  </div>
                )}
                {/* レビュー傾向 */}
                {product.reviewSummary && (
                  <div style={{ fontSize: 11, color: "#555", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 5, padding: "5px 8px" }}>
                    <span style={{ fontSize: 10, color: "#16A34A", fontWeight: 700 }}>📊 レビュー傾向: </span>{product.reviewSummary}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AIコピー生成完了プレビュー */}
          {copies && copies.some(c => c) && (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "12px 14px", marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Icon name="check_circle" size={14} color="#16A34A" />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#16A34A" }}>3バリエーションのコピーを生成しました！</span>
                <span style={{ fontSize: 10, color: "#6b7280" }}>→ 次のステップのテキスト欄に反映済み</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {VARIATIONS.map((v, i) => {
                  const lines = (copies[i] || "").split("\n");
                  return (
                    <div key={v.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#fff", borderRadius: 7, padding: "6px 10px", border: "1px solid #d1fae5" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#16A34A", background: "#dcfce7", borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap", flexShrink: 0 }}>{v.label}</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>{lines[0] || ""}</div>
                        <div style={{ fontSize: 11, color: "#666" }}>{lines[1] || ""}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Prompt collapsible */}
          <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 10 }}>
            <button onClick={()=>setShowPrompt(p=>!p)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="description" size={13} color="#bbb" />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>追加プロンプト（任意）</span>
                {savedPrompts.length > 0 && <span style={{ fontSize: 10, background: "#f0f0f0", color: "#888", borderRadius: 9, padding: "1px 6px", fontWeight: 700 }}>{savedPrompts.length}件保存済み</span>}
              </div>
              <Icon name={showPrompt?"collapse":"expand"} size={16} color="#bbb" />
            </button>
            {showPrompt && (
              <div style={{ padding: "0 16px 14px" }}>
                <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} rows={3} placeholder="AIへの特別な指示（例：『高級感を強調して』『セール情報を目立たせて』など）" style={{ width: "100%", padding: "10px 12px", background: "#fafafa", border: "1px solid #efefef", borderRadius: 7, fontSize: 13, color: "#444", resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.55 }} />
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button onClick={saveCurrentPrompt} disabled={!prompt.trim()} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 6, border: "1px solid #e0e0e0", background: "#fff", fontSize: 11, fontWeight: 600, color: prompt.trim() ? "#555" : "#ccc", cursor: prompt.trim() ? "pointer" : "not-allowed" }}>
                    💾 テンプレートとして保存
                  </button>
                  {savedPrompts.length > 0 && (
                    <button onClick={() => setShowSavedPrompts(p=>!p)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 6, border: "1px solid #e0e0e0", background: "#fff", fontSize: 11, fontWeight: 600, color: "#555", cursor: "pointer" }}>
                      📋 保存済みを使う
                    </button>
                  )}
                </div>
                {showSavedPrompts && savedPrompts.length > 0 && (
                  <div style={{ marginTop: 8, background: "#fafafa", border: "1px solid #e8e8e8", borderRadius: 8, overflow: "hidden" }}>
                    {savedPrompts.map((sp) => (
                      <div key={sp.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderBottom: "1px solid #f0f0f0", cursor: "pointer" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#fff3ee"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <div style={{ flex: 1 }} onClick={() => { setPrompt(sp.text); setShowSavedPrompts(false); }}>
                          <div style={{ fontSize: 12, color: "#333", marginBottom: 2 }}>{sp.text.slice(0, 50)}{sp.text.length > 50 ? "..." : ""}</div>
                          <div style={{ fontSize: 10, color: "#bbb" }}>{sp.date}</div>
                        </div>
                        <button onClick={() => deletePrompt(sp.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 14, padding: "0 4px" }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {!canNext && <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 7 }}><Icon name="info" size={13} color="#D97706" /><span style={{ fontSize: 12, color: "#92400E" }}>URLまたは画像（商品 or モデル）を入力してください</span></div>}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════
   STEP 3
   ═══════════════ */

/* ── 動画生成ソース画像選択タブ ── */
const ImageSourceTab = ({ images, modelImages, selectedVideoImg, setSelectedVideoImg, falApiKey, product }) => {
  const [compositing, setCompositing] = useState(false);
  const [compositeErr, setCompositeErr] = useState("");

  // 全画像リスト: 商品画像 + モデル画像
  const productImgs = images || [];
  const modelImgs   = modelImages || [];
  const allImgs = [
    ...productImgs.map(img => ({ ...img, tag: "商品", tagColor: "#2563EB" })),
    ...modelImgs.map(img => ({ ...img, tag: "モデル", tagColor: "#7C3AED" })),
  ];
  // デフォルト選択（null=商品画像優先）
  const activeUrl = selectedVideoImg || productImgs[0]?.url || modelImgs[0]?.url;

  // FAL.ai Flux image-to-image で商品をモデル画像に合成
  const handleComposite = async () => {
    if (!falApiKey) { setCompositeErr("FAL.ai APIキーが必要です"); return; }
    const modelImg = modelImgs[0]?.url;
    const productImg = productImgs[0]?.url;
    if (!modelImg || !productImg) { setCompositeErr("モデル画像と商品画像の両方が必要です"); return; }
    setCompositing(true); setCompositeErr("");
    try {
      const productName = product?.productName || "product";
      const authHeaders = { "Authorization": `Key ${falApiKey}` };

      // ── Helper: URL → FAL.ai CDN URL ──────────────────────────────────
      // blob: / data: URL はFAL.aiサーバーから直接取得できないのでアップロードする
      const toFalUrl = async (url) => {
        // すでにFAL.ai / GCS CDNならそのまま返す
        if (url.startsWith("https://") &&
            (url.includes("fal.media") || url.includes("storage.googleapis") ||
             url.includes("cdn.fal") || url.includes("v3.fal"))) {
          return url;
        }
        let blob;
        if (url.startsWith("blob:") || url.startsWith("data:")) {
          // ローカルBlob/DataURL → Blobに変換
          const r = await fetch(url);
          blob = await r.blob();
        } else {
          // 外部HTTPS URL (EC site等) → fetchしてアップロード (失敗したらそのまま返す)
          try {
            const r = await fetch(url, { mode: "cors" });
            blob = await r.blob();
          } catch {
            return url; // CORSで取れない場合はURLをそのまま渡してFAL側で処理
          }
        }
        const form = new FormData();
        form.append("file", blob, "image.jpg");
        const upRes = await fetch("https://rest.fal.run/storage/upload/file", {
          method: "POST",
          headers: authHeaders,
          body: form,
        });
        if (!upRes.ok) throw new Error(`画像アップロード失敗: ${upRes.status}`);
        const upJson = await upRes.json();
        return upJson?.url || upJson?.access_url || url;
      };

      // モデル画像をFAL.ai CDN URLに変換
      const modelImgUrl = await toFalUrl(modelImg);

      // ── Flux image-to-image へ送信 ────────────────────────────────────
      const FAL_MODEL = "fal-ai/flux/dev/image-to-image";
      const submitRes = await fetch(`https://queue.fal.run/${FAL_MODEL}`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: modelImgUrl,
          prompt: `Japanese commercial product photo. The person is shown using and holding ${productName} prominently. Product clearly visible and centered in foreground. Professional studio lighting. High quality EC site photography.`,
          strength: 0.45,
          num_images: 1,
          guidance_scale: 7.5,
          num_inference_steps: 28,
        }),
      });
      if (!submitRes.ok) {
        const errText = await submitRes.text().catch(() => "");
        throw new Error(`送信失敗 HTTP ${submitRes.status}${errText ? ": " + errText.slice(0, 80) : ""}`);
      }
      const submitJson = await submitRes.json();
      const requestId = submitJson?.request_id;
      if (!requestId) throw new Error("リクエストID未取得 (レスポンス: " + JSON.stringify(submitJson).slice(0, 80) + ")");

      const statusUrl = submitJson?.status_url ||
        `https://queue.fal.run/${FAL_MODEL}/requests/${requestId}/status`;
      const responseUrl = submitJson?.response_url ||
        `https://queue.fal.run/${FAL_MODEL}/requests/${requestId}`;

      // ── ポーリング ────────────────────────────────────────────────────
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const sRes = await fetch(statusUrl, { headers: authHeaders });
        if (!sRes.ok) continue;
        const sJson = await sRes.json();
        if (sJson?.status === "COMPLETED") {
          const rRes = await fetch(responseUrl, { headers: authHeaders });
          const rJson = await rRes.json();
          const imgUrl = rJson?.images?.[0]?.url || rJson?.output?.images?.[0]?.url;
          if (imgUrl) {
            setSelectedVideoImg(imgUrl);
            setCompositeErr("✅ 合成完了！画像が選択されました");
            break;
          } else {
            throw new Error("合成画像URLが取得できませんでした");
          }
        }
        if (sJson?.status === "FAILED") {
          throw new Error("合成失敗: " + (sJson?.error || sJson?.detail || "不明"));
        }
      }
    } catch (e) {
      console.error("[Flux Composite] Error:", e);
      setCompositeErr("合成エラー: " + (e.message || String(e)));
    } finally {
      setCompositing(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}>
        <Icon name="image" size={14} color="#f06a28" />
        <span style={{ fontSize: 13, fontWeight: 700 }}>動画生成ソース画像</span>
      </div>

      {/* 注意書き */}
      <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, padding: "9px 11px", marginBottom: 12, fontSize: 11, color: "#92400E", lineHeight: 1.6 }}>
        <b>重要:</b> この画像がそのまま動画のスタート画像になります。<br/>
        「モデルが商品を持つ動画」を作るには、<b>実際にモデルが商品を持った写真</b>を使用するか、下の「AI合成」をお試しください。
      </div>

      {/* 画像グリッド */}
      {allImgs.length === 0 ? (
        <div style={{ textAlign: "center", color: "#bbb", fontSize: 12, padding: "20px 0" }}>画像がありません<br/>Step 2 で画像をアップロードしてください</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {allImgs.map((img, i) => {
            const isSelected = activeUrl === img.url;
            return (
              <div key={i} onClick={() => setSelectedVideoImg(img.url)}
                style={{ position: "relative", borderRadius: 9, overflow: "hidden", border: `2.5px solid ${isSelected ? "#f06a28" : "#E8EAF0"}`, cursor: "pointer", boxShadow: isSelected ? "0 0 0 3px rgba(240,106,40,0.18)" : "none", transition: "all 0.15s" }}
              >
                <img src={img.url} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                {/* タグ */}
                <div style={{ position: "absolute", top: 5, left: 5, background: img.tagColor, color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>{img.tag}</div>
                {/* 選択チェック */}
                {isSelected && (
                  <div style={{ position: "absolute", top: 5, right: 5, width: 20, height: 20, background: "#f06a28", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name="check" size={11} color="#fff" />
                  </div>
                )}
                {/* 使用中バナー */}
                {isSelected && (
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(240,106,40,0.85)", color: "#fff", fontSize: 9, fontWeight: 700, textAlign: "center", padding: "3px 0" }}>使用中</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* デフォルトに戻す */}
      {selectedVideoImg && (
        <button onClick={() => setSelectedVideoImg(null)}
          style={{ width: "100%", padding: "7px", borderRadius: 7, border: "1px dashed #CBD5E1", background: "#F8F9FB", fontSize: 11, color: "#64748B", cursor: "pointer", marginBottom: 12, fontWeight: 600 }}
        >
          ↺ デフォルト（商品画像優先）に戻す
        </button>
      )}

      {/* アセットから画像を選択 */}
      {(() => {
        try {
          const savedAssets = JSON.parse(localStorage.getItem("sg_visual_assets") || "[]").filter(a => a.type === "image" && a.dataUrl);
          if (savedAssets.length === 0) return null;
          return (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 7, display: "flex", alignItems: "center", gap: 5 }}>
                <span>🗂️</span> アセットから選択
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {savedAssets.slice(0, 6).map((a, i) => {
                  const isSel = activeUrl === a.dataUrl;
                  return (
                    <div key={i} onClick={() => setSelectedVideoImg(a.dataUrl)}
                      style={{ position: "relative", borderRadius: 7, overflow: "hidden", border: `2px solid ${isSel ? "#f06a28" : "#E8EAF0"}`, cursor: "pointer", aspectRatio: "1", boxShadow: isSel ? "0 0 0 3px rgba(240,106,40,0.18)" : "none" }}
                    >
                      <img src={a.dataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      {isSel && <div style={{ position: "absolute", inset: 0, background: "rgba(240,106,40,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 16, height: 16, background: "#f06a28", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="9" height="9" viewBox="0 0 24 24" fill="#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div></div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        } catch { return null; }
      })()}

      {/* AI合成ボタン */}
      {productImgs.length > 0 && modelImgs.length > 0 && (
        <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 10, padding: "12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6D28D9", marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
            <span>✨</span>AI画像合成（ベータ）
          </div>
          <div style={{ fontSize: 10, color: "#7C3AED", lineHeight: 1.6, marginBottom: 10 }}>
            モデル画像に商品を合成した新しい画像を生成します。<br/>
            FAL.ai APIキーが必要です（Flux使用）。
          </div>
          <button onClick={handleComposite} disabled={compositing || !falApiKey}
            style={{ width: "100%", padding: "9px", borderRadius: 8, border: "none", background: compositing ? "#E9D5FF" : "#7C3AED", color: "#fff", fontSize: 12, fontWeight: 700, cursor: compositing ? "not-allowed" : "pointer" }}
          >
            {compositing ? "合成中..." : "🎨 モデル＋商品を合成する"}
          </button>
          {compositeErr && <div style={{ marginTop: 6, fontSize: 10, color: "#DC2626", lineHeight: 1.4 }}>{compositeErr}</div>}
          {!falApiKey && <div style={{ marginTop: 6, fontSize: 10, color: "#9333EA" }}>※ FAL.ai APIキーを設定してください</div>}
        </div>
      )}
    </div>
  );
};

const Step3 = ({ product, images, modelImages, template, platform, aiModel, variation, setVariation, copies, setCopies, bgm, setBgm, voice, setVoice, titleText, setTitleText, selectedFont, setSelectedFont, subtitlePreset, setSubtitlePreset, transitionPreset, setTransitionPreset, overlayPreset, setOverlayPreset, onBack, onRegenerate, generating, genStep, genProgress, genError, isRealGenerating, onExport, falApiKey, onSetApiKey,
  cameraMove, setCameraMove, motionStrength, setMotionStrength, negativePrompt, setNegativePrompt, videoDuration, setVideoDuration, lightingStyle, setLightingStyle, aiPromptMode, setAiPromptMode, finalPromptPreview,
  selectedVideoImg, setSelectedVideoImg,
}) => {
  // デフォルトは商品画像優先（モデル画像は参考用）
  const mainImg = selectedVideoImg || images[0]?.url || modelImages[0]?.url;
  const curVar = VARIATIONS.find(v=>v.id===variation);
  const tmpl = TEMPLATES.find(t=>t.id===template);
  const varIdx = VARIATIONS.findIndex(v=>v.id===variation);
  const curCopy = copies[varIdx]||"";
  const [editTab, setEditTab] = useState("title");
  const [previewRatio, setPreviewRatio] = useState(PLATFORMS.find(p=>p.id===platform)?.ratio||"9:16");
  const [copyIdx, setCopyIdx] = useState(0);
  const selectedModel = AI_MODELS.find(m=>m.id===aiModel);
  const fontStyle = FONTS.find(f=>f.id===selectedFont)?.style||{};
  const [mobileFrame, setMobileFrame] = useState("iphone"); // "iphone" | "android" | "none"
  const [compareMode, setCompareMode] = useState(false);
  const [shareToast, setShareToast] = useState(false);

  const previewStyle = previewRatio==="9:16" ? { width: 248, aspectRatio: "9/16" } : previewRatio==="1:1" ? { width: 290, aspectRatio: "1/1" } : { width: 380, aspectRatio: "16/9" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <Stepper step={3} onBack={onBack} showBack
        extra={
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setCompareMode(p => !p)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 11px", borderRadius: 6, border: `1px solid ${compareMode?"#4F6EF7":"#e0e0e0"}`, background: compareMode?"#EEF2FF":"#fff", fontSize: 12, fontWeight: 600, color: compareMode?"#4F6EF7":"#555", cursor: "pointer" }}>
              <Icon name="compare" size={13} color={compareMode?"#4F6EF7":"#555"} />比較ビュー
            </button>
            <button onClick={onRegenerate} disabled={generating} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 11px", borderRadius: 6, border: "1px solid #e0e0e0", background: "#fff", fontSize: 12, fontWeight: 600, color: generating?"#ccc":"#555", cursor: generating?"not-allowed":"pointer" }}><Icon name="refresh" size={13} color={generating?"#ddd":"#f06a28"} />再生成</button>
          </div>
        }
      />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT: Variations */}
        <div style={{ width: 204, borderRight: "1px solid #e8e8e8", background: "#fff", overflowY: "auto", padding: "11px 8px", flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#ccc", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 9, paddingLeft: 3 }}>バリエーション</div>
          {VARIATIONS.map(v => (
            <div key={v.id} onClick={()=>setVariation(v.id)} style={{ borderRadius: 9, overflow: "hidden", border: `2px solid ${variation===v.id?"#f06a28":"#eaeaea"}`, cursor: "pointer", marginBottom: 9, boxShadow: variation===v.id?"0 0 0 3px rgba(240,106,40,0.09)":"none", opacity: variation===v.id?1:0.62, transition: "all 0.13s" }}>
              <div style={{ aspectRatio: "9/10", background: v.bg, position: "relative", overflow: "hidden" }}>
                {mainImg && <img src={mainImg} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.82 }} />}
                {!mainImg && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="image" size={26} color="rgba(255,255,255,0.1)" /></div>}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(0,0,0,0.6) 0%,transparent 50%)" }} />
                {/* プレビューバッジ */}
                <div style={{ position: "absolute", top: 5, right: 5, fontSize: 8, fontWeight: 700, background: "rgba(0,0,0,0.45)", color: "rgba(255,255,255,0.75)", padding: "2px 5px", borderRadius: 3, letterSpacing: "0.04em" }}>プレビュー</div>
                {titleText && (
                  <div style={{ position: "absolute", top: "50%", left: 8, right: 8, transform: "translateY(-50%)", textAlign: "center" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: v.accent, textShadow: "0 1px 6px rgba(0,0,0,0.6)", lineHeight: 1.2, ...fontStyle }}>{titleText}</div>
                  </div>
                )}
                <div style={{ position: "absolute", bottom: 7, left: 7, right: 7 }}>
                  {v.recommended && <span style={{ fontSize: 8, background: "#f06a28", color: "#fff", padding: "1px 5px", borderRadius: 9, fontWeight: 700, marginBottom: 3, display: "inline-block" }}>AI推奨</span>}
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{v.label}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)" }}>マッチ度 {v.match}%</div>
                </div>
              </div>
            </div>
          ))}
          {/* Model badge */}
          {selectedModel && (
            <div style={{ marginTop: 6, padding: "8px 10px", background: "#fafafa", border: "1px solid #eaeaea", borderRadius: 8 }}>
              <div style={{ fontSize: 9, color: "#bbb", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>使用モデル</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 8, background: PROVIDER_COLORS[selectedModel.provider]+"22", color: PROVIDER_COLORS[selectedModel.provider], padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>{PROVIDER_LABELS[selectedModel.provider]}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#333" }}>{selectedModel.name}</span>
              </div>
            </div>
          )}
        </div>

        {/* CENTER */}
        <div style={{ flex: 1, background: "#f2f3f5", display: "flex", flexDirection: "column", alignItems: "center", padding: "18px 14px", overflow: "auto" }}>
          {/* Controls row */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", justifyContent: "center" }}>
            {/* Ratio toggle */}
            <div style={{ display: "flex", background: "#fff", border: "1px solid #e8e8e8", borderRadius: 8, padding: 2, gap: 2 }}>
              {[["9:16","縦"],["1:1","正方"],["16:9","横"]].map(([val,label]) => (
                <button key={val} onClick={()=>setPreviewRatio(val)} style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: previewRatio===val?"#f06a28":"transparent", color: previewRatio===val?"#fff":"#aaa", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.13s" }}>
                  {val} <span style={{ opacity: 0.7, fontSize: 10 }}>{label}</span>
                </button>
              ))}
            </div>
            {/* Mobile frame */}
            {previewRatio === "9:16" && (
              <div style={{ display: "flex", background: "#fff", border: "1px solid #e8e8e8", borderRadius: 8, padding: 2, gap: 2 }}>
                {[["none","フレームなし"],["iphone","iPhone"],["android","Android"]].map(([val,label]) => (
                  <button key={val} onClick={()=>setMobileFrame(val)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: mobileFrame===val?"#1A202C":"transparent", color: mobileFrame===val?"#fff":"#aaa", fontSize: 10, fontWeight: 600, cursor: "pointer", transition: "all 0.13s" }}>{label}</button>
                ))}
              </div>
            )}
            {/* Share button */}
            <button onClick={() => {
              const shareText = `ShortGen AI プロジェクト\nテンプレート: ${TEMPLATES.find(t=>t.id===template)?.label||"不明"}\nプラットフォーム: ${PLATFORM_LABELS[platform]||platform}`;
              navigator.clipboard.writeText(shareText).then(() => {
                setShareToast(true);
                setTimeout(() => setShareToast(false), 2000);
              });
            }} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 12px", borderRadius: 8, border: "1px solid #e8e8e8", background: "#fff", fontSize: 11, fontWeight: 600, color: "#555", cursor: "pointer" }}>
              <Icon name="share" size={13} color="#555" />共有
            </button>
            {shareToast && <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#22C55E", color: "#fff", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>✓ コピーしました</div>}
          </div>

          {/* 比較ビュー */}

          {/* プレビューエリア */}
          {compareMode ? (
            <div style={{ display: "flex", gap: 12, overflow: "auto", paddingBottom: 8 }}>
              {VARIATIONS.map((v, vi) => {
                const vCopy = copies[vi] || "";
                return (
                  <div key={v.id} onClick={() => { setVariation(v.id); setCompareMode(false); }} style={{ flexShrink: 0, cursor: "pointer", opacity: variation===v.id?1:0.75, transition: "opacity 0.15s" }}>
                    <div style={{ width: 140, aspectRatio: "9/16", background: v.bg, borderRadius: 10, position: "relative", overflow: "hidden", border: `2px solid ${variation===v.id?"#f06a28":"#e0e0e0"}`, boxShadow: variation===v.id?"0 0 0 3px rgba(240,106,40,0.15)":"none" }}>
                      {mainImg && <img src={mainImg} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.6 }} />}
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.85) 100%)" }} />
                      {titleText && <div style={{ position: "absolute", top: "30%", left: 7, right: 7, textAlign: "center", transform: "translateY(-50%)", fontSize: 11, fontWeight: 900, color: v.accent, textShadow: "0 1px 8px rgba(0,0,0,0.6)", lineHeight: 1.2, ...fontStyle }}>{titleText}</div>}
                      <div style={{ position: "absolute", bottom: 10, left: 7, right: 7, textAlign: "center" }}>
                        {vCopy.split("\n").map((l,i) => <div key={i} style={{ color: v.accent, fontSize: i===0?9:7, fontWeight: 700, lineHeight: 1.3, textShadow: "0 1px 6px rgba(0,0,0,0.5)", marginBottom: 2 }}>{l}</div>)}
                      </div>
                      {variation===v.id && <div style={{ position: "absolute", top: 5, right: 5, width: 18, height: 18, background: "#f06a28", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="check" size={10} color="#fff" /></div>}
                      {v.recommended && <div style={{ position: "absolute", top: 5, left: 5 }}><span style={{ fontSize: 7, background: "#f06a28", color: "#fff", padding: "1px 4px", borderRadius: 4, fontWeight: 700 }}>AI推奨</span></div>}
                    </div>
                    <div style={{ marginTop: 6, textAlign: "center" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: variation===v.id?"#f06a28":"#555" }}>{v.label}</div>
                      <div style={{ fontSize: 9, color: "#bbb" }}>マッチ度 {v.match}%</div>
                      {variation===v.id && <div style={{ fontSize: 9, color: "#f06a28", fontWeight: 700 }}>選択中</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : generating ? (
            <div style={{ width: 250, aspectRatio: "9/16", background: "#1a1a1a", borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, boxShadow: "0 20px 50px rgba(0,0,0,0.2)", padding: "0 20px" }}>
              <div style={{ width: 34, height: 34, border: "3px solid rgba(240,106,40,0.2)", borderTop: "3px solid #f06a28", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              <div style={{ color: "#fff", fontSize: 12, fontWeight: 600, textAlign: "center" }}>
                {isRealGenerating ? genProgress : AI_STEPS[genStep]}
              </div>
              <div style={{ width: 140, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: isRealGenerating ? "70%" : `${((genStep+1)/AI_STEPS.length)*100}%`, background: "#f06a28", borderRadius: 2, transition: "width 0.5s" }} />
              </div>
              {selectedModel && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>{selectedModel.name} で生成中...</div>}
              {isRealGenerating && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textAlign: "center", lineHeight: 1.4 }}>実際の動画を生成中です<br/>1〜5分かかる場合があります</div>}
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              {/* モバイルフレーム */}
              {previewRatio === "9:16" && mobileFrame === "iphone" ? (
                <div style={{ position: "relative", width: 268, height: 480 }}>
                  <div style={{ position: "absolute", inset: 0, border: "10px solid #1a1a1a", borderRadius: 36, boxShadow: "0 0 0 2px #444, 0 22px 54px rgba(0,0,0,0.35)", pointerEvents: "none", zIndex: 2 }}>
                    <div style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)", width: 80, height: 18, background: "#1a1a1a", borderRadius: 9, zIndex: 3 }} />
                  </div>
                  <div style={{ ...previewStyle, position: "absolute", inset: 10, borderRadius: 26, overflow: "hidden", background: curVar?.bg||"#111" }}>
                    {mainImg && <img src={mainImg} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.72 }} />}
                    {!mainImg && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="image" size={48} color="rgba(255,255,255,0.07)" /></div>}
                    {overlayPreset!=="None"&&<div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(255,220,100,0.18) 0%, transparent 40%, rgba(255,150,80,0.12) 100%)", pointerEvents: "none" }} />}
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 25%, rgba(0,0,0,0.88) 100%)" }} />
                    <div style={{ position: "absolute", top: 9, left: 9 }}><span style={{ fontSize: 9, background: "rgba(0,0,0,0.45)", color: "#fff", padding: "2px 7px", borderRadius: 5, fontWeight: 600, backdropFilter: "blur(4px)" }}>{tmpl?.label}</span></div>
                    {titleText && <div style={{ position: "absolute", top: "30%", left: 12, right: 12, textAlign: "center", transform: "translateY(-50%)" }}><div style={{ fontSize: 22, fontWeight: 900, color: curVar?.accent||"#fff", textShadow: "0 2px 16px rgba(0,0,0,0.7)", lineHeight: 1.2, ...fontStyle }}>{titleText}</div></div>}
                    <div style={{ position: "absolute", bottom: 36, left: 12, right: 12, textAlign: "center" }}>{curCopy.split("\n").map((l,i) => <div key={i} style={{ color: curVar?.accent||"#fff", fontSize: i===0?17:12, fontWeight: 800, lineHeight: 1.3, textShadow: "0 2px 9px rgba(0,0,0,0.5)", marginBottom: 3 }}>{l}</div>)}</div>
                    {subtitlePreset!=="Standard"&&<div style={{ position: "absolute", bottom: 14, left: 12, right: 12, textAlign: "center" }}><span style={{ fontSize: 9, background: "rgba(0,0,0,0.7)", color: "#fff", padding: "2px 8px", borderRadius: 3, fontWeight: 600 }}>字幕 — {subtitlePreset}</span></div>}
                    <div style={{ position: "absolute", bottom: 4, left: 12, right: 12, height: 2, background: "rgba(255,255,255,0.1)", borderRadius: 1 }}><div style={{ height: "100%", width: "33%", background: "#f06a28", borderRadius: 1 }} /></div>
                  </div>
                </div>
              ) : previewRatio === "9:16" && mobileFrame === "android" ? (
                <div style={{ position: "relative", width: 264, height: 476 }}>
                  <div style={{ position: "absolute", inset: 0, border: "8px solid #222", borderRadius: 24, boxShadow: "0 0 0 1.5px #444, 0 22px 54px rgba(0,0,0,0.3)", pointerEvents: "none", zIndex: 2 }}>
                    <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", width: 10, height: 10, borderRadius: "50%", background: "#333" }} />
                  </div>
                  <div style={{ position: "absolute", inset: 8, borderRadius: 16, overflow: "hidden", background: curVar?.bg||"#111" }}>
                    {mainImg && <img src={mainImg} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.72 }} />}
                    {!mainImg && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="image" size={48} color="rgba(255,255,255,0.07)" /></div>}
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 25%, rgba(0,0,0,0.88) 100%)" }} />
                    <div style={{ position: "absolute", top: 9, left: 9 }}><span style={{ fontSize: 9, background: "rgba(0,0,0,0.45)", color: "#fff", padding: "2px 7px", borderRadius: 5, fontWeight: 600 }}>{tmpl?.label}</span></div>
                    {titleText && <div style={{ position: "absolute", top: "30%", left: 12, right: 12, textAlign: "center", transform: "translateY(-50%)" }}><div style={{ fontSize: 22, fontWeight: 900, color: curVar?.accent||"#fff", textShadow: "0 2px 16px rgba(0,0,0,0.7)", lineHeight: 1.2, ...fontStyle }}>{titleText}</div></div>}
                    <div style={{ position: "absolute", bottom: 36, left: 12, right: 12, textAlign: "center" }}>{curCopy.split("\n").map((l,i) => <div key={i} style={{ color: curVar?.accent||"#fff", fontSize: i===0?17:12, fontWeight: 800, lineHeight: 1.3, textShadow: "0 2px 9px rgba(0,0,0,0.5)", marginBottom: 3 }}>{l}</div>)}</div>
                    <div style={{ position: "absolute", bottom: 4, left: 12, right: 12, height: 2, background: "rgba(255,255,255,0.1)", borderRadius: 1 }}><div style={{ height: "100%", width: "33%", background: "#f06a28", borderRadius: 1 }} /></div>
                  </div>
                </div>
              ) : (
                <div style={{ position: "relative" }}>
                  <div style={{ ...previewStyle, background: curVar?.bg||"#111", borderRadius: previewRatio==="16:9"?10:15, position: "relative", overflow: "hidden", boxShadow: "0 22px 54px rgba(0,0,0,0.2)" }}>
                    {mainImg && <img src={mainImg} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.72 }} />}
                    {!mainImg && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="image" size={48} color="rgba(255,255,255,0.07)" /></div>}
                    {overlayPreset!=="None"&&<div style={{ position: "absolute", inset: 0, background: overlayPreset==="Bokeh particles"?"radial-gradient(circle at 20% 30%, rgba(255,200,100,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(100,150,255,0.12) 0%, transparent 50%)":overlayPreset==="Light leaks"?"linear-gradient(135deg, rgba(255,220,100,0.18) 0%, transparent 40%, rgba(255,150,80,0.12) 100%)":overlayPreset==="Warm lightleaks"?"linear-gradient(120deg, rgba(255,200,80,0.2) 0%, transparent 60%)":overlayPreset==="Cold lightleaks"?"linear-gradient(120deg, rgba(100,180,255,0.18) 0%, transparent 60%)":"linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.2) 100%)", pointerEvents: "none" }} />}
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 25%, rgba(0,0,0,0.88) 100%)" }} />
                    <div style={{ position: "absolute", top: 9, left: 9 }}>
                      <span style={{ fontSize: 9, background: "rgba(0,0,0,0.45)", color: "#fff", padding: "2px 7px", borderRadius: 5, fontWeight: 600, backdropFilter: "blur(4px)" }}>{tmpl?.label}</span>
                    </div>
                    {titleText && (
                      <div style={{ position: "absolute", top: "30%", left: 12, right: 12, textAlign: "center", transform: "translateY(-50%)" }}>
                        <div style={{ fontSize: previewRatio==="16:9"?18:22, fontWeight: 900, color: curVar?.accent||"#fff", textShadow: "0 2px 16px rgba(0,0,0,0.7)", lineHeight: 1.2, ...fontStyle }}>{titleText}</div>
                      </div>
                    )}
                    <div style={{ position: "absolute", bottom: 36, left: 12, right: 12, textAlign: "center" }}>
                      {curCopy.split("\n").map((l,i) => (
                        <div key={i} style={{ color: curVar?.accent||"#fff", fontSize: previewRatio==="16:9"?(i===0?15:11):(i===0?17:12), fontWeight: 800, lineHeight: 1.3, textShadow: "0 2px 9px rgba(0,0,0,0.5)", marginBottom: 3 }}>{l}</div>
                      ))}
                    </div>
                    {subtitlePreset!=="Standard"&&(
                      <div style={{ position: "absolute", bottom: 14, left: 12, right: 12, textAlign: "center" }}>
                        <span style={{ fontSize: 9, background: "rgba(0,0,0,0.7)", color: "#fff", padding: "2px 8px", borderRadius: 3, fontWeight: subtitlePreset==="Bold popping"?900:600, letterSpacing: subtitlePreset==="All caps"?"0.08em":"0", textTransform: subtitlePreset==="All caps"?"uppercase":"none" }}>字幕プレビュー — {subtitlePreset}</span>
                      </div>
                    )}
                    <div style={{ position: "absolute", bottom: 4, left: 12, right: 12, height: 2, background: "rgba(255,255,255,0.1)", borderRadius: 1 }}>
                      <div style={{ height: "100%", width: "33%", background: "#f06a28", borderRadius: 1 }} />
                    </div>
                  </div>
                  <div style={{ position: "absolute", right: -42, top: "40%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 4, background: "#fff", border: "1px solid #e8e8e8", borderRadius: 8, padding: 4, boxShadow: "0 2px 7px rgba(0,0,0,0.05)" }}>
                    {[{icon:"tune",a:true},{icon:"smart_display",a:false},{icon:"share",a:false}].map((b,i)=>(
                      <button key={i} style={{ width: 30, height: 30, borderRadius: 5, border: "none", background: b.a?"#fff8f5":"#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Icon name={b.icon} size={14} color={b.a?"#f06a28":"#ccc"} /></button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Export */}
          {!generating && !compareMode && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 14 }}>
              {genError && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#fff0f0", border: "1px solid #fecaca", borderRadius: 8, fontSize: 11, color: "#dc2626", maxWidth: 320, textAlign: "center" }}>
                  <Icon name="info" size={13} color="#dc2626" />{genError}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={onExport}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 8, border: "none", background: "#f06a28", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 3px 10px rgba(240,106,40,0.26)" }}
                >
                  <Icon name="bolt" size={14} color="#fff" />
                  {falApiKey ? "AIで動画を生成する" : "APIキーを設定して生成"}
                </button>
              </div>
              {falApiKey && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#22C55E" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E" }} />
                  Fal.ai 接続済み — {AI_MODELS.find(m=>m.id===aiModel)?.name || "Kling"} 使用
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Edit Panel */}
        <div style={{ width: 270, borderLeft: "1px solid #e8e8e8", background: "#fff", overflowY: "auto", flexShrink: 0 }}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #e8e8e8", padding: "0 10px", position: "sticky", top: 0, background: "#fff", zIndex: 1, overflowX: "auto" }}>
            {[
              { id: "image",      icon: "image",       label: "画像"     },
              { id: "title",      icon: "title",       label: "タイトル" },
              { id: "copy",       icon: "description", label: "コピー"   },
              { id: "camera",     icon: "timeline",    label: "カメラ"   },
              { id: "ai",         icon: "auto_awesome",label: "AI強化"   },
              { id: "subtitle",   icon: "text_fields", label: "字幕"     },
              { id: "transition", icon: "transition",  label: "切替"     },
              { id: "bgm",        icon: "music_note",  label: "BGM"      },
              { id: "voice",      icon: "mic",         label: "ボイス"   },
            ].map(t => (
              <button key={t.id} onClick={()=>setEditTab(t.id)} style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 8px 6px", border: "none", borderBottom: `2px solid ${editTab===t.id?"#f06a28":"transparent"}`, background: "transparent", fontSize: 9, fontWeight: editTab===t.id?700:500, color: editTab===t.id?"#f06a28":"#bbb", cursor: "pointer", marginBottom: -1 }}>
                <Icon name={t.icon} size={13} color={editTab===t.id?"#f06a28":"#ccc"} />{t.label}
              </button>
            ))}
          </div>

          <div style={{ padding: 13 }}>
            {/* ── Image Tab ── */}
            {editTab==="image" && (
              <ImageSourceTab
                images={images}
                modelImages={modelImages}
                selectedVideoImg={selectedVideoImg}
                setSelectedVideoImg={setSelectedVideoImg}
                falApiKey={falApiKey}
                product={product}
              />
            )}

            {/* ── Title Tab ── */}
            {editTab==="title" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 12 }}>
                  <Icon name="title" size={14} color="#f06a28" />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>タイトルクリップ</span>
                </div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#777", marginBottom: 6 }}>タイトルテキスト</label>
                <textarea value={titleText} onChange={e=>setTitleText(e.target.value)} rows={2} placeholder="例：時を超えるミニマリズム" style={{ width: "100%", padding: "9px 10px", borderRadius: 7, border: "1px solid #e8e8e8", fontSize: 13, color: "#333", resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box", background: "#fafafa", lineHeight: 1.5, ...fontStyle }} />
                {product?.titleText && <button onClick={()=>setTitleText(product.titleText)} style={{ fontSize: 10, color: "#f06a28", background: "none", border: "none", cursor: "pointer", marginTop: 4, padding: 0 }}>AI推奨タイトルを使用: "{product.titleText}"</button>}

                <div style={{ marginTop: 14 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#777", marginBottom: 8 }}>フォント選択</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                    {FONTS.map(f => {
                      const sel = selectedFont === f.id;
                      return (
                        <button key={f.id} onClick={()=>setSelectedFont(f.id)} style={{ padding: "9px 10px", borderRadius: 8, border: `1.5px solid ${sel?"#f06a28":"#eaeaea"}`, background: sel?"#fff8f5":"#fafafa", cursor: "pointer", textAlign: "center", transition: "all 0.12s" }}>
                          <div style={{ fontSize: 15, ...f.style, color: sel?"#f06a28":"#222", marginBottom: 2 }}>Aa</div>
                          <div style={{ fontSize: 9, color: sel?"#f06a28":"#aaa", fontWeight: 600 }}>{f.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── Copy Tab ── */}
            {editTab==="copy" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 11 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Icon name="description" size={14} color="#f06a28" />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>AI キャッチコピー</span>
                  </div>
                  <button style={{ fontSize: 10, fontWeight: 700, color: "#f06a28", background: "none", border: "none", cursor: "pointer" }}>リライト</button>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: "#bbb", fontWeight: 600, marginBottom: 6 }}>候補から選択</div>
                  {COPY_CANDIDATES.map((c,i)=>(
                    <div key={i} onClick={()=>{ setCopyIdx(i); setCopies(prev=>{ const n=[...prev]; n[varIdx]=`${c[0]}\n${c[1]}`; return n; }); }} style={{ padding: "7px 9px", borderRadius: 7, border: `1.5px solid ${copyIdx===i?"#f06a28":"#eaeaea"}`, background: copyIdx===i?"#fff8f5":"#fafafa", cursor: "pointer", marginBottom: 5, transition: "all 0.12s" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: copyIdx===i?"#f06a28":"#333", marginBottom: 1 }}>{c[0]}</div>
                      <div style={{ fontSize: 10, color: "#aaa" }}>{c[1]}</div>
                    </div>
                  ))}
                </div>
                {VARIATIONS.map((v,vi)=>(
                  <div key={v.id} style={{ marginBottom: 9 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: variation===v.id?"#f06a28":"#ccc", marginBottom: 3, display: "flex", alignItems: "center", gap: 3 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: v.accent }} />{v.label}
                    </div>
                    <textarea value={copies[vi]||""} rows={2} onClick={()=>setVariation(v.id)} onChange={e=>setCopies(p=>{const n=[...p];n[vi]=e.target.value;return n;})} style={{ width: "100%", padding: "8px 9px", borderRadius: 7, border: `1.5px solid ${variation===v.id?"#f06a28":"#eaeaea"}`, fontSize: 11, color: "#333", resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box", background: variation===v.id?"#fff8f5":"#fafafa", lineHeight: 1.5 }} />
                  </div>
                ))}
              </div>
            )}

            {/* ── Camera Control ── */}
            {editTab==="camera" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 14 }}>
                  <Icon name="timeline" size={14} color="#f06a28" />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>カメラコントロール</span>
                </div>

                {/* カメラムーブ選択 */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 8, letterSpacing: "0.05em" }}>カメラムーブ</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {[
                      { id: "none",       label: "なし",         icon: "—" },
                      { id: "slow-push",  label: "スロープッシュ", icon: "→" },
                      { id: "pull-back",  label: "引き",          icon: "←" },
                      { id: "orbit",      label: "オービット",    icon: "↻" },
                      { id: "zoom-in",    label: "ズームイン",    icon: "⊕" },
                      { id: "zoom-out",   label: "ズームアウト",  icon: "⊖" },
                      { id: "pan-right",  label: "右パン",        icon: "▶" },
                      { id: "pan-left",   label: "左パン",        icon: "◀" },
                      { id: "tilt-up",    label: "チルトアップ",  icon: "▲" },
                      { id: "tilt-down",  label: "チルトダウン",  icon: "▼" },
                      { id: "handheld",   label: "手持ち",        icon: "✋" },
                      { id: "static",     label: "固定",          icon: "■" },
                    ].map(c => (
                      <button key={c.id} onClick={() => setCameraMove(c.id)}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 9px", borderRadius: 8, border: `1.5px solid ${cameraMove===c.id?"#f06a28":"#E8EAF0"}`, background: cameraMove===c.id?"#fff8f5":"#F8F9FB", cursor: "pointer", fontSize: 11, fontWeight: cameraMove===c.id?700:500, color: cameraMove===c.id?"#f06a28":"#475569", transition: "all 0.15s" }}
                      >
                        <span style={{ fontSize: 12, width: 16, textAlign: "center" }}>{c.icon}</span>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* モーション強度 */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.05em" }}>モーション強度</div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#f06a28" }}>
                      {motionStrength <= 0.2 ? "超スロー" : motionStrength <= 0.4 ? "ゆっくり" : motionStrength <= 0.6 ? "標準" : motionStrength <= 0.8 ? "ダイナミック" : "最大"}
                    </span>
                  </div>
                  <input type="range" min="0.1" max="1.0" step="0.1" value={motionStrength}
                    onChange={e => setMotionStrength(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "#f06a28" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#94A3B8", marginTop: 3 }}>
                    <span>静止</span><span>標準</span><span>激しい</span>
                  </div>
                </div>

                {/* 動画長 */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 8, letterSpacing: "0.05em" }}>動画の長さ</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["5", "10"].map(d => (
                      <button key={d} onClick={() => setVideoDuration(d)}
                        style={{ flex: 1, padding: "8px", borderRadius: 8, border: `1.5px solid ${videoDuration===d?"#f06a28":"#E8EAF0"}`, background: videoDuration===d?"#fff8f5":"#F8F9FB", cursor: "pointer", fontSize: 12, fontWeight: 700, color: videoDuration===d?"#f06a28":"#64748B", transition: "all 0.15s" }}
                      >
                        {d}秒
                      </button>
                    ))}
                  </div>
                </div>

                {/* ライティングスタイル */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 8, letterSpacing: "0.05em" }}>ライティング</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {[
                      { id: "studio",       label: "スタジオ",    emoji: "🎥" },
                      { id: "golden-hour",  label: "ゴールデン",  emoji: "🌅" },
                      { id: "dramatic",     label: "ドラマティック", emoji: "🎭" },
                      { id: "natural",      label: "ナチュラル",  emoji: "🌿" },
                      { id: "neon",         label: "ネオン",      emoji: "💜" },
                      { id: "luxury",       label: "ラグジュアリー", emoji: "✨" },
                    ].map(l => (
                      <button key={l.id} onClick={() => setLightingStyle(l.id)}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 9px", borderRadius: 8, border: `1.5px solid ${lightingStyle===l.id?"#f06a28":"#E8EAF0"}`, background: lightingStyle===l.id?"#fff8f5":"#F8F9FB", cursor: "pointer", fontSize: 11, fontWeight: lightingStyle===l.id?700:500, color: lightingStyle===l.id?"#f06a28":"#475569", transition: "all 0.15s" }}
                      >
                        <span>{l.emoji}</span>{l.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── AI強化パネル ── */}
            {editTab==="ai" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                  <Icon name="auto_awesome" size={14} color="#f06a28" />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>AIプロンプト強化</span>
                </div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 14, lineHeight: 1.6 }}>
                  Claudeが商品情報・カメラ設定を元にKling最適化プロンプトを自動生成します。競合他社と差をつける核心機能です。
                </div>

                {/* AI強化モード */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 8, letterSpacing: "0.05em" }}>プロンプトモード</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { id: "auto",   label: "🤖 AI自動強化（推奨）",    desc: "Claude が自動でシネマティック最適化" },
                      { id: "manual", label: "✍️ 手動プロンプト",          desc: "自分でプロンプトを入力" },
                      { id: "hybrid", label: "⚡ ハイブリッド",            desc: "AI生成をベースに手動で調整" },
                    ].map(m => (
                      <button key={m.id} onClick={() => setAiPromptMode(m.id)}
                        style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${aiPromptMode===m.id?"#f06a28":"#E8EAF0"}`, background: aiPromptMode===m.id?"#fff8f5":"#F8F9FB", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: aiPromptMode===m.id?"#f06a28":"#1A202C", marginBottom: 2 }}>{m.label}</div>
                          <div style={{ fontSize: 10.5, color: "#94A3B8" }}>{m.desc}</div>
                        </div>
                        {aiPromptMode===m.id && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f06a28", marginTop: 3 }} />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ネガティブプロンプト */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.05em" }}>ネガティブプロンプト</div>
                    <button
                      onClick={() => setNegativePrompt("blurry, distorted, watermark, text overlay, extra limbs, morphing, artifacts, low quality, overexposed, underexposed")}
                      style={{ fontSize: 9.5, color: "#f06a28", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
                    >おすすめを入力</button>
                  </div>
                  <textarea
                    value={negativePrompt}
                    onChange={e => setNegativePrompt(e.target.value)}
                    placeholder="例: blurry, watermark, distorted, text overlay..."
                    rows={3}
                    style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #E8EAF0", borderRadius: 8, fontSize: 11, color: "#334155", resize: "vertical", fontFamily: "inherit", outline: "none", background: "#F8F9FB", boxSizing: "border-box" }}
                  />
                  <div style={{ fontSize: 9.5, color: "#94A3B8", marginTop: 4 }}>排除したい要素を英語で記述</div>
                </div>

                {/* プロンプトプレビュー */}
                {finalPromptPreview && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 6, letterSpacing: "0.05em" }}>
                      最終プロンプトプレビュー
                    </div>
                    <div style={{ background: "#0F172A", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10.5, color: "#94D2BD", lineHeight: 1.7, fontFamily: "monospace" }}>
                        {finalPromptPreview}
                      </div>
                    </div>
                    <div style={{ fontSize: 9.5, color: "#94A3B8", marginTop: 4 }}>← 生成時に送信されるプロンプト</div>
                  </div>
                )}
              </div>
            )}

            {/* ── Subtitle Presets ── */}
            {editTab==="subtitle" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 12 }}>
                  <Icon name="text_fields" size={14} color="#f06a28" />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>字幕プリセット</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {SUBTITLE_PRESETS.map(p=>(
                    <button key={p} onClick={()=>setSubtitlePreset(p)} style={{ padding: "6px 11px", borderRadius: 7, border: `1.5px solid ${subtitlePreset===p?"#f06a28":"#eaeaea"}`, background: subtitlePreset===p?"#fff8f5":"#fafafa", fontSize: 11, fontWeight: subtitlePreset===p?700:500, color: subtitlePreset===p?"#f06a28":"#555", cursor: "pointer", transition: "all 0.12s" }}>{p}</button>
                  ))}
                </div>
                <button style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 12, padding: "7px 12px", borderRadius: 7, border: "1px dashed #e0e0e0", background: "#fafafa", fontSize: 11, fontWeight: 600, color: "#888", cursor: "pointer", width: "100%" }}>
                  <Icon name="add" size={13} color="#bbb" />カスタムプリセットを追加
                </button>
              </div>
            )}

            {/* ── Transition Presets ── */}
            {editTab==="transition" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 12 }}>
                  <Icon name="transition" size={14} color="#f06a28" />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>トランジションプリセット</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TRANSITION_PRESETS.map(p=>(
                    <button key={p} onClick={()=>setTransitionPreset(p)} style={{ padding: "6px 11px", borderRadius: 7, border: `1.5px solid ${transitionPreset===p?"#f06a28":"#eaeaea"}`, background: transitionPreset===p?"#fff8f5":"#fafafa", fontSize: 11, fontWeight: transitionPreset===p?700:500, color: transitionPreset===p?"#f06a28":"#555", cursor: "pointer", transition: "all 0.12s" }}>{p}</button>
                  ))}
                </div>
                <button style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 12, padding: "7px 12px", borderRadius: 7, border: "1px dashed #e0e0e0", background: "#fafafa", fontSize: 11, fontWeight: 600, color: "#888", cursor: "pointer", width: "100%" }}>
                  <Icon name="add" size={13} color="#bbb" />カスタムプリセットを追加
                </button>
              </div>
            )}

            {/* ── Overlay Presets ── */}
            {editTab==="overlay" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 12 }}>
                  <Icon name="overlay" size={14} color="#f06a28" />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>オーバーレイ / エフェクト</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {OVERLAY_PRESETS.map(p=>(
                    <button key={p} onClick={()=>setOverlayPreset(p)} style={{ padding: "6px 11px", borderRadius: 7, border: `1.5px solid ${overlayPreset===p?"#f06a28":"#eaeaea"}`, background: overlayPreset===p?"#fff8f5":"#fafafa", fontSize: 11, fontWeight: overlayPreset===p?700:500, color: overlayPreset===p?"#f06a28":"#555", cursor: "pointer", transition: "all 0.12s" }}>{p}</button>
                  ))}
                </div>
                <button style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 12, padding: "7px 12px", borderRadius: 7, border: "1px dashed #e0e0e0", background: "#fafafa", fontSize: 11, fontWeight: 600, color: "#888", cursor: "pointer", width: "100%" }}>
                  <Icon name="add" size={13} color="#bbb" />カスタムオーバーレイを追加
                </button>
              </div>
            )}

            {/* ── BGM ── */}
            {editTab==="bgm" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 12 }}>
                  <Icon name="music_note" size={14} color="#f06a28" />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>BGM 選択</span>
                </div>
                {BGMS.map((b,i)=>{
                  const sel=bgm===i;
                  return (
                    <div key={b.id} onClick={()=>setBgm(i)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 8, border: `1.5px solid ${sel?"#f06a28":"#eaeaea"}`, background: sel?"#fff8f5":"#fafafa", cursor: "pointer", marginBottom: 6, transition: "all 0.12s" }}>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", background: sel?"#f06a28":"#eaeaea", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="play_circle" size={14} color={sel?"#fff":"#bbb"} /></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>{b.label}</div>
                        <div style={{ fontSize: 10, color: "#bbb" }}>{b.sub}</div>
                      </div>
                      {sel && <Icon name="check_circle" size={14} color="#f06a28" />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Voice ── */}
            {editTab==="voice" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 9 }}>
                  <Icon name="mic" size={14} color="#f06a28" />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>AI ボイス選択</span>
                </div>
                <p style={{ fontSize: 11, color: "#bbb", marginBottom: 12, lineHeight: 1.5 }}>商品に合う声をAIが推奨。自由に変更できます。</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                  {VOICES.map((v,i)=>{
                    const sel=voice===i;
                    return (
                      <button key={v.id} onClick={()=>setVoice(i)} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "11px 7px", borderRadius: 9, border: `1.5px solid ${sel?"#f06a28":"#eaeaea"}`, background: sel?"#fff8f5":"#fafafa", cursor: "pointer", position: "relative", transition: "all 0.12s" }}>
                        {i===0 && <span style={{ position: "absolute", top: -5, right: -3, fontSize: 8, background: "#f06a28", color: "#fff", padding: "1px 4px", borderRadius: 5, fontWeight: 700 }}>推奨</span>}
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: sel?"#f06a28":"#eaeaea", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 5 }}><Icon name="person" size={16} color={sel?"#fff":"#bbb"} /></div>
                        <span style={{ fontSize: 11, fontWeight: sel?700:500, color: sel?"#f06a28":"#666" }}>{v.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Product info */}
            {product && (
              <div style={{ marginTop: 16, background: "#fafafa", border: "1px solid #eaeaea", borderRadius: 9, padding: 11 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#ccc", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 9 }}>商品情報</div>
                {[["商品名",product.productName],["ターゲット",product.target],["価格帯",product.price]].map(([k,v])=>(
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 7 }}>
                    <span style={{ color: "#bbb" }}>{k}</span>
                    <span style={{ fontWeight: 700, color: "#111", maxWidth: 110, textAlign: "right", wordBreak: "break-word" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════
   FAL.AI モデルマッピング
   ═══════════════════════════════ */
const FAL_MODEL_MAP = {
  kling3:   "fal-ai/kling-video/v2.1/pro/image-to-video",
  kling3o:  "fal-ai/kling-video/v2.1/standard/image-to-video",
  minimax:  "fal-ai/minimax/video-01/image-to-video",
  kling26:  "fal-ai/kling-video/v2.1/pro/image-to-video",
  kling25t: "fal-ai/kling-video/v2.1/standard/image-to-video",
  ltx2p:    "fal-ai/ltx-2.3/image-to-video/fast",
};
// Klingモデルはstart_image_url、LTX/MiniMaxはimage_urlを使う
const FAL_IMAGE_FIELD = {
  kling3: "start_image_url", kling3o: "start_image_url",
  kling26: "start_image_url", kling25t: "start_image_url",
  minimax: "image_url",
  ltx2p: "image_url",
};

/* ═══════════════════════════════════════════════════════════════
   ✨ AIプロンプト強化エンジン（競合優位性の核心）
   ユーザーのシンプルなコピーを、Kling最適化シネマティックプロンプトに変換
   ═══════════════════════════════════════════════════════════════ */
const PLATFORM_CINEMA_CONTEXT = {
  tiktok:   "vertical 9:16 TikTok — viral hook in first 2 seconds, fast dynamic jump cuts, Gen-Z energy, trend-driven pacing, FOMO-triggering urgency, bold product reveal moments",
  reels:    "vertical 9:16 Instagram Reels — aesthetic lifestyle cinematography, smooth cinematic transitions, aspirational warm color grading, product seamlessly in lifestyle context",
  shorts:   "vertical 9:16 YouTube Shorts — clear immediate value delivery, punchy informative pacing, clean instructional visuals, broad demographic appeal",
  ec:       "square 1:1 e-commerce product showcase — clean professional studio look, detailed product close-ups, crisp commercial quality lighting",
  youtube:  "horizontal 16:9 YouTube — cinematic storytelling arc, high production value, broad appeal",
  twitter:  "horizontal 16:9 social — punchy eye-catching opener, concise impactful message",
};

const TEMPLATE_VISUAL_GUIDE = {
  product:  "Hero product reveal: dramatic close-up, showcase texture and design details, premium unboxing feel",
  sale:     "Urgency-driven visuals: bold price reveal, countdown energy, high-contrast color, limited-time scarcity atmosphere",
  brand:    "Brand world storytelling: emotional lifestyle journey, aspirational imagery, premium brand identity moments",
  review:   "Authentic testimonial feel: before/after contrast, social proof moments, real use-case in everyday life",
  tips:     "Step-by-step instructional reveal: satisfying how-to sequence, clear transformation moment, educational pacing",
  service:  "Service experience walkthrough: professional credibility shots, customer journey, trust-building moments",
};

const CAMERA_MOVE_PROMPTS = {
  none:         "",
  "slow-push":  "slow dolly push-in toward product, shallow depth of field",
  "pull-back":  "slow dolly pull-back reveal, expanding scene",
  "pan-right":  "smooth pan right, following product reveal",
  "pan-left":   "smooth pan left, cinematic sweep",
  "orbit":      "slow orbital camera arc around subject, 270-degree sweep",
  "tilt-up":    "slow camera tilt up, rising reveal",
  "tilt-down":  "slow camera tilt down, descending dramatic shot",
  "zoom-in":    "slow zoom in, telephoto compression, subject isolation",
  "zoom-out":   "dramatic zoom out, revealing wider environment",
  "handheld":   "subtle handheld camera movement, natural organic feel",
  "static":     "completely static camera, no movement, product-focus",
};

const LIGHTING_STYLE_PROMPTS = {
  "studio":      "clean studio lighting, soft box lights, even illumination, white background",
  "golden-hour": "warm golden hour sunlight, long shadows, cinematic warmth",
  "dramatic":    "dramatic chiaroscuro lighting, deep shadows, single key light, moody",
  "natural":     "natural soft window light, diffused, lifestyle feel",
  "neon":        "neon accent lighting, vibrant color gels, urban night aesthetic",
  "luxury":      "high-key luxury lighting, bright clean whites, premium feel, specular highlights",
};

async function buildCinematicPrompt({
  productName, category, catchphrase, mainCopy, platform,
  cameraMove, motionStrength, lightingStyle, userPrompt, templateLabel, templateId, claudeApiKey,
}) {
  const platformCtx  = PLATFORM_CINEMA_CONTEXT[platform] || PLATFORM_CINEMA_CONTEXT.tiktok;
  const cameraCtx    = CAMERA_MOVE_PROMPTS[cameraMove] || "";
  const lightCtx     = LIGHTING_STYLE_PROMPTS[lightingStyle] || "";
  const templateCtx  = TEMPLATE_VISUAL_GUIDE[templateId] || "";

  const systemPrompt = `You are an expert AI video prompt engineer specializing in Kling AI image-to-video generation.
Your task: Transform product marketing copy into a highly optimized cinematic video prompt.

CRITICAL RULE — PRODUCT CONSISTENCY (most important):
- The product MUST remain IDENTICAL throughout the video — same shape, same color, same design
- Begin prompt with: "PRODUCT STAYS IDENTICAL, [product name] product unchanged throughout, "
- Describe ONLY camera movement and environment changes — the product itself must NOT morph or change
- Use gentle, controlled motion to prevent product distortion
- Avoid abstract or heavy artistic transformations

KLING BEST PRACTICES:
- Subject first, then motion, then camera, then style
- If the image shows a person, describe how they hold/use the product (product stays same)
- Cinematography: "slow dolly push-in", "static shot", "subtle handheld", "shallow DOF f/2.8"
- Motion intensity: ${motionStrength <= 0.3 ? "subtle, minimal movement, product-focused static shot" : motionStrength <= 0.6 ? "gentle, controlled, product stays sharp" : "moderate, product clearly visible at all times"}
- Max 5-7 elements — keep it focused
- End with: camera + lighting + "product identity preserved"

OUTPUT: Single paragraph, max 130 words, English only, no markdown.`;

  const userMsg = `Product: ${productName || "product"}
Category: ${category || "general"}
Catchphrase: ${catchphrase || ""}
Copy: ${mainCopy || ""}
Platform: ${platformCtx}
Template style: ${templateCtx || templateLabel || "product showcase"}
Camera: ${cameraCtx || "natural camera movement"}
Lighting: ${lightCtx || "soft natural lighting"}
User notes: ${userPrompt || ""}

Generate the optimal Kling image-to-video prompt:`;

  if (!claudeApiKey) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeApiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [{ role: "user", content: userMsg }],
        system: systemPrompt,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const enhanced = data.content?.find(b => b.type === "text")?.text?.trim() || "";
    return enhanced || null;
  } catch {
    return null;
  }
}



/* ── Fal.ai 動画生成（Anthropic API をサーバーサイドプロキシとして使用）── */
// Claude APIはサーバーサイドでHTTP fetchを実行できるため、CORSを完全に回避できる
// ── FAL.ai 直接呼び出し（CORS対応済み） ──
const ASPECT_RATIO_MAP = { tiktok:"9:16", reels:"9:16", shorts:"9:16", ec:"1:1", youtube:"16:9", twitter:"16:9" };

async function generateVideoViaClaude({ falApiKey, imageUrl, promptText, negativePrompt, modelId, platform, duration = "5", motionStrength = 0.5, onProgress }) {
  const falModel = FAL_MODEL_MAP[modelId] || "fal-ai/kling-video/v3/pro/image-to-video";
  const aspectRatio = ASPECT_RATIO_MAP[platform] || "9:16";

  const headers = {
    "Authorization": `Key ${falApiKey}`,
    "Content-Type": "application/json",
  };

  // base64画像の場合は先にFAL storageにアップロード
  let finalImageUrl = imageUrl;
  if (imageUrl.startsWith("data:")) {
    onProgress?.("画像をアップロード中...");
    try {
      // base64 → Blob変換
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const formData = new FormData();
      formData.append("file", blob, "product.jpg");
      const uploadRes = await fetch("https://rest.fal.run/storage/upload/file", {
        method: "POST",
        headers: { "Authorization": `Key ${falApiKey}` },
        body: formData,
      });
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        finalImageUrl = uploadData?.url || imageUrl;
      }
      // アップロード失敗時はdata:URIをそのまま使用（モデルによっては対応）
    } catch (e) {
      // フォールバック: data:URIのまま送信
    }
  }

  onProgress?.("FAL.ai にリクエスト送信中...");

  // ステップ1: キューにサブミット
  const isLtx = modelId === "ltx2p";
  const imageField = FAL_IMAGE_FIELD[modelId] || "start_image_url";
  const submitBody = {
    [imageField]: finalImageUrl,
    prompt: promptText,
    duration: isLtx ? Math.max(6, Number(duration)) : Number(duration),
    aspect_ratio: aspectRatio,
  };
  // モデル別パラメータ設定
  const isMinimax = modelId === "minimax";
  if (isLtx) {
    // LTX-2.3: 音声生成をOFFにして高速化
    submitBody.generate_audio = false;
  } else if (isMinimax) {
    // MiniMax Video 01: パラメータはpromptとimage_urlのみ（cfg_scale/negative_prompt非対応）
    // durationはサポートしない（5秒固定）
    delete submitBody.duration;
    delete submitBody.aspect_ratio;
  } else {
    // Klingのみcfg_scaleとnegative_promptをサポート
    submitBody.cfg_scale = motionStrength;
    if (negativePrompt && negativePrompt.trim()) {
      submitBody.negative_prompt = negativePrompt.trim();
    }
  }

  const submitRes = await fetch(`https://queue.fal.run/${falModel}`, {
    method: "POST",
    headers,
    body: JSON.stringify(submitBody),
  });

  if (!submitRes.ok) {
    const errText = await submitRes.text().catch(() => String(submitRes.status));
    let errMsg = errText;
    try { errMsg = JSON.parse(errText)?.detail || JSON.parse(errText)?.message || errText; } catch {}
    throw new Error(`FAL.ai エラー (${submitRes.status}): ${errMsg.slice(0, 200)}`);
  }

  const submitJson = await submitRes.json();

  // 同期で動画URLが返った場合（モデルによっては即時返却）
  const syncUrl = submitJson?.video?.url || submitJson?.output?.video?.url;
  if (syncUrl) return syncUrl;

  const requestId = submitJson?.request_id;
  if (!requestId) {
    throw new Error("リクエストID未取得: " + JSON.stringify(submitJson).slice(0, 200));
  }

  // サブミットレスポンスのURLを優先使用（フォールバックは手動構築）
  const statusUrl = submitJson?.status_url ||
    `https://queue.fal.run/${falModel}/requests/${requestId}/status`;
  const responseUrl = submitJson?.response_url ||
    `https://queue.fal.run/${falModel}/requests/${requestId}`;

  onProgress?.("動画を生成中... しばらくお待ちください（目安: 1〜3分）");

  // ステップ2: ポーリング（5秒間隔 × 最大96回 = 8分）
  let lastStatus = "";
  for (let i = 0; i < 96; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const pct = Math.min(i * 4 + 8, 92);

    try {
      const statusRes = await fetch(statusUrl, { headers });
      if (!statusRes.ok) {
        onProgress?.(`生成中... ${pct}% (ステータス確認中)`);
        continue;
      }
      const statusJson = await statusRes.json();
      lastStatus = statusJson?.status || lastStatus;

      // キュー待機中は位置を表示
      if (lastStatus === "IN_QUEUE") {
        const pos = statusJson?.queue_position;
        onProgress?.(`キュー待機中${pos != null ? `（${pos}番目）` : ""}... ${pct}%`);
      } else if (lastStatus === "IN_PROGRESS") {
        onProgress?.(`生成処理中... ${pct}%`);
      } else {
        onProgress?.(`生成中... ${pct}%`);
      }

      // ステータスレスポンスに動画URLが直接含まれる場合
      const inlineUrl =
        statusJson?.video?.url ||
        statusJson?.output?.video?.url ||
        statusJson?.data?.video?.url;
      if (inlineUrl) return inlineUrl;

      if (statusJson?.status === "COMPLETED") {
        // 結果を別途取得
        const resultRes = await fetch(responseUrl, { headers });
        if (!resultRes.ok) throw new Error("結果取得失敗 (status=" + resultRes.status + ")");
        const resultJson = await resultRes.json();
        const videoUrl =
          resultJson?.video?.url ||
          resultJson?.output?.video?.url ||
          resultJson?.data?.video?.url ||
          resultJson?.outputs?.[0]?.video?.url;
        if (videoUrl) return videoUrl;
        throw new Error("動画URLが見つかりません: " + JSON.stringify(resultJson).slice(0, 300));
      }

      if (statusJson?.status === "FAILED") {
        const errLogs = (statusJson?.logs || []).map(l => l?.message).filter(Boolean).join("; ");
        throw new Error("生成失敗: " + (statusJson?.error || errLogs || "原因不明"));
      }
    } catch (e) {
      if (e.message.includes("生成失敗") || e.message.includes("動画URL") || e.message.includes("結果取得失敗")) throw e;
      // ネットワークエラーは継続
    }
  }
  throw new Error(`タイムアウト（8分超過、最終ステータス: ${lastStatus || "不明"}）。FAL.aiダッシュボードで状況を確認してください。`);
}

/* ── APIキー設定モーダル ── *//* ── APIキー設定モーダル ── */
const ApiKeyModal = ({ onSave, onClose }) => {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 440, boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, background: "#fff3ee", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="bolt" size={18} color="#f06a28" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#111" }}>Fal.ai APIキーを設定</div>
            <div style={{ fontSize: 11, color: "#aaa" }}>動画生成に使用します。このブラウザにのみ保存されます。</div>
          </div>
        </div>

        <div style={{ background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 10, padding: "12px 14px", marginBottom: 16, marginTop: 14 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 8, fontWeight: 600 }}>APIキーの取得方法</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {["① fal.ai にアカウント登録","② ダッシュボード → 「API Keys」","③ 「Create Key」でキーを発行","④ 下のフォームに貼り付け"].map((s,i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#666" }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#f06a28", color: "#fff", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i+1}</div>
                {s.slice(3)}
              </div>
            ))}
          </div>
          <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: 11, color: "#f06a28", fontWeight: 700, textDecoration: "none" }}>→ fal.ai ダッシュボードを開く ↗</a>
        </div>

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>APIキー</label>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 12px", background: "#fafafa", border: "1.5px solid #e0e0e0", borderRadius: 9, marginBottom: 18 }}>
          <Icon name="bolt" size={14} color="#ccc" />
          <input
            type={show ? "text" : "password"}
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="fal_key_xxxxxxxxxxxxxxxx"
            style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: "#333", background: "transparent", fontFamily: "monospace" }}
          />
          <button onClick={() => setShow(p => !p)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#aaa", padding: 0 }}>
            {show ? "隠す" : "表示"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #e0e0e0", background: "#fff", fontSize: 13, fontWeight: 600, color: "#666", cursor: "pointer" }}>
            キャンセル
          </button>
          <button
            onClick={() => { if (key.trim()) onSave(key.trim()); }}
            disabled={!key.trim()}
            style={{ flex: 2, padding: "10px", borderRadius: 8, border: "none", background: key.trim() ? "#f06a28" : "#e0e0e0", color: "#fff", fontSize: 13, fontWeight: 700, cursor: key.trim() ? "pointer" : "not-allowed", boxShadow: key.trim() ? "0 3px 10px rgba(240,106,40,0.3)" : "none" }}
          >
            保存して動画生成を開始
          </button>
        </div>
        <p style={{ fontSize: 10, color: "#ccc", textAlign: "center", marginTop: 10 }}>キーはブラウザに保存され、動画生成時にFAL.aiへ安全に送信されます</p>
      </div>
    </div>
  );
};

/* ── 生成済み動画プレビュー ── */
const VideoResult = ({ url, onClose, onDownload, titleText, copyText, subtitlePreset }) => {
  const [speaking, setSpeaking] = useState(false);

  const speakText = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    // タイトルと重複する行は除いて読み上げ
    const lines = copyText ? copyText.split("\n").filter(Boolean) : [];
    const subLines = (titleText && lines[0] === titleText) ? lines.slice(1) : lines;
    const speakContent = (titleText ? titleText + "。" : "") + subLines.join("。");
    if (!speakContent.trim()) return;
    const utter = new window.SpeechSynthesisUtterance(speakContent);
    utter.lang = "ja-JP";
    utter.rate = 0.92;
    utter.pitch = 1.05;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  };

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  useEffect(() => {
    // コンポーネントアンマウント時にナレーションを停止
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  // タイトルと重複するコピー行を除去（1行目がタイトルと同じなら除外）
  const allCopyLines = copyText ? copyText.split("\n").filter(Boolean) : [];
  const displayCopyLines = (titleText && allCopyLines[0] === titleText)
    ? allCopyLines.slice(1)
    : allCopyLines;
  const hasCopy = displayCopyLines.length > 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14 }}>
      <div style={{ background: "#111", borderRadius: 16, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", position: "relative" }}>
        <video src={url} controls autoPlay muted loop style={{ display: "block", maxHeight: "75vh", maxWidth: "90vw" }} />

        {/* タイトルオーバーレイ */}
        {titleText && (
          <div style={{ position: "absolute", top: "38%", left: 12, right: 12, textAlign: "center", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", textShadow: "0 2px 18px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.8)", lineHeight: 1.25 }}>
              {titleText}
            </div>
          </div>
        )}

        {/* コピーテキストオーバーレイ（テロップ・タイトルと重複する行は除外） */}
        {hasCopy && (
          <div style={{ position: "absolute", bottom: 32, left: 12, right: 12, textAlign: "center", pointerEvents: "none" }}>
            {displayCopyLines.map((l, i) => (
              <div key={i} style={{
                display: "inline-block",
                color: "#fff",
                fontSize: i === 0 ? 16 : 12,
                fontWeight: 800,
                lineHeight: 1.5,
                textShadow: "0 2px 10px rgba(0,0,0,0.95)",
                marginBottom: 3,
                padding: subtitlePreset !== "Standard" ? "2px 8px" : "1px 4px",
                background: subtitlePreset !== "Standard" ? "rgba(0,0,0,0.55)" : "transparent",
                borderRadius: 3,
                letterSpacing: subtitlePreset === "All caps" ? "0.08em" : "normal",
                textTransform: subtitlePreset === "All caps" ? "uppercase" : "none",
                width: "100%",
                boxSizing: "border-box",
              }}>{l}</div>
            ))}
          </div>
        )}

        <div style={{ position: "absolute", top: 8, right: 8 }}>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="close" size={13} color="#fff" />
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={onDownload} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 22px", borderRadius: 9, border: "none", background: "#f06a28", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 3px 12px rgba(240,106,40,0.35)" }}>
          <Icon name="download" size={15} color="#fff" />動画をダウンロード
        </button>

        {window.speechSynthesis && hasCopy && (
          speaking ? (
            <button onClick={stopSpeaking} style={{ padding: "10px 18px", borderRadius: 9, border: "1.5px solid #f06a28", background: "rgba(240,106,40,0.15)", color: "#f06a28", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              ⏹ 音声停止
            </button>
          ) : (
            <button onClick={speakText} style={{ padding: "10px 18px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              🔊 ナレーション再生
            </button>
          )
        )}

        <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          閉じる
        </button>
      </div>
    </div>
  );
};

/* ═══════════════
   PROJECTS PAGE
   ═══════════════ */
const ProjectsPage = ({ onCreateNew, userName }) => {
  const [tab, setTab] = useState("all");
  const [menuOpen, setMenuOpen] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast, setToast] = useState("");
  const [previewProject, setPreviewProject] = useState(null); // 動画プレビュー

  // localStorageからプロジェクト読み込み（ダミーデータなし）
  const [projects, setProjects] = useState(() => {
    try {
      const saved = localStorage.getItem("sg_projects");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // コンテキストメニューの外部クリック閉じる
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (!e.target.closest("[data-menu-btn]")) setMenuOpen(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const saveProjects = (newProjects) => {
    setProjects(newProjects);
    localStorage.setItem("sg_projects", JSON.stringify(newProjects));
  };

  const handleDelete = (id) => {
    saveProjects(projects.filter(p => p.id !== id));
    setDeleteConfirm(null);
    setMenuOpen(null);
    showToast("プロジェクトを削除しました");
  };
  const handleDuplicate = (p) => {
    const newP = { ...p, id: Date.now(), title: p.title + " (コピー)", date: new Date().toLocaleDateString("ja-JP"), status: "draft" };
    saveProjects([newP, ...projects]);
    setMenuOpen(null);
    showToast("複製しました");
  };
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const filtered = projects
    .filter(p => searchQuery ? p.title.toLowerCase().includes(searchQuery.toLowerCase()) : true)
    .filter(p => tab === "all" ? true : tab === "drafts" ? (p.status === "draft" || p.status === "completed") : p.status === "exported");

  const statusBadge = (p) => {
    if (p.status === "completed") return (
      <div style={{ position: "absolute", top: 12, left: 12, display: "flex", alignItems: "center", gap: 5, background: "rgba(0,0,0,0.62)", borderRadius: 6, padding: "4px 10px" }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E" }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.08em" }}>COMPLETED</span>
      </div>
    );
    if (p.status === "generating") return (
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.06em" }}>GENERATING {p.progress}%</div>
        <div style={{ width: "60%", height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 99 }}>
          <div style={{ height: "100%", width: `${p.progress}%`, background: "#fff", borderRadius: 99 }} />
        </div>
      </div>
    );
    if (p.status === "draft") return (
      <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(255,255,255,0.18)", backdropFilter: "blur(4px)", borderRadius: 6, padding: "4px 10px" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.08em" }}>DRAFT</span>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#F8F9FB" }}>
      {/* トースト */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1A202C", color: "#fff", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
          ✓ {toast}
        </div>
      )}
      {/* 動画プレビューモーダル */}
      {previewProject && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14 }}
          onClick={() => setPreviewProject(null)}>
          <div style={{ background: "#111", borderRadius: 16, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", position: "relative" }}
            onClick={e => e.stopPropagation()}>
            <video src={previewProject.videoUrl} controls autoPlay muted loop style={{ display: "block", maxHeight: "75vh", maxWidth: "85vw" }} />
            <div style={{ position: "absolute", top: 8, right: 8 }}>
              <button onClick={() => setPreviewProject(null)} style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", cursor: "pointer", color: "#fff", fontSize: 16, lineHeight: 1 }}>✕</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <a href={previewProject.videoUrl} download={previewProject.title + ".mp4"} style={{ padding: "10px 22px", borderRadius: 9, border: "none", background: "#f06a28", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              ⬇ ダウンロード
            </a>
            <button onClick={() => setPreviewProject(null)} style={{ padding: "10px 18px", borderRadius: 9, border: "1.5px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              閉じる
            </button>
          </div>
        </div>
      )}
      {/* 削除確認モーダル */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 24, width: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1A202C", marginBottom: 8 }}>プロジェクトを削除しますか？</div>
            <div style={{ fontSize: 13, color: "#64748B", marginBottom: 20 }}>この操作は元に戻せません。</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: "8px 20px", border: "1px solid #e0e0e0", borderRadius: 8, background: "#fff", fontSize: 13, fontWeight: 600, color: "#555", cursor: "pointer" }}>キャンセル</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ padding: "8px 20px", border: "none", borderRadius: 8, background: "#EF4444", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>削除する</button>
            </div>
          </div>
        </div>
      )}
      {/* トップバー */}
      <header style={{ height: 58, background: "#fff", borderBottom: "1px solid #EEF0F4", display: "flex", alignItems: "center", padding: "0 28px", gap: 16, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1A202C", letterSpacing: "-0.03em" }}>Projects</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#F4F6F9", border: "1px solid #E8EAF0", borderRadius: 10, padding: "7px 14px", width: 240 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="#94A3B8"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="プロジェクトを検索..." style={{ border: "none", background: "transparent", outline: "none", fontSize: 12.5, color: "#333", fontFamily: "inherit", flex: 1 }} />
        </div>
        {/* ユーザー */}
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#F4F6F9", border: "1px solid #E8EAF0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="#64748B"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
            <div style={{ position: "absolute", top: 6, right: 6, width: 7, height: 7, borderRadius: "50%", background: "#f06a28", border: "1.5px solid #fff" }} />
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1A202C" }}>{userName || "User"}</div>
            <div style={{ fontSize: 10.5, color: "#94A3B8" }}>Pro Account</div>
          </div>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#4F6EF7,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>{(userName || "U").charAt(0).toUpperCase()}</div>
        </div>
      </header>

      {/* コンテンツ */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
        {/* タイトル + Create New */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1A202C", letterSpacing: "-0.03em", marginBottom: 4 }}>Projects</h1>
            <p style={{ fontSize: 13, color: "#64748B" }}>AI生成動画を管理・整理する</p>
          </div>
          <button onClick={onCreateNew} style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 22px", background: "linear-gradient(135deg,#f06a28,#e8420a)", color: "#fff", border: "none", borderRadius: 12, fontSize: 13.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(240,106,40,0.38)", letterSpacing: "-0.01em" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            新規作成
          </button>
        </div>

        {/* タブ */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "2px solid #EEF0F4" }}>
          {[{ id: "all", label: "All Projects" }, { id: "drafts", label: "Drafts" }, { id: "exported", label: "Exported" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "9px 18px", background: "none", border: "none", borderBottom: tab === t.id ? "2px solid #f06a28" : "2px solid transparent", marginBottom: -2, fontSize: 13.5, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? "#f06a28" : "#64748B", cursor: "pointer", letterSpacing: "-0.01em", transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* プロジェクトが空の場合 */}
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "64px 24px", background: "#fff", borderRadius: 16, border: "1px dashed #D1D9E6" }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>🎬</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#334155", marginBottom: 6 }}>プロジェクトがありません</div>
            <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 20 }}>動画を生成するとここに表示されます</div>
            <button onClick={onCreateNew} style={{ padding: "10px 24px", background: "#f06a28", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              新規動画を作成
            </button>
          </div>
        )}

        {/* プロジェクトグリッド */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {filtered.map(p => (
            <div key={p.id}
              style={{ background: "#fff", border: "1px solid #EEF0F4", borderRadius: 16, overflow: "hidden", cursor: "pointer", transition: "box-shadow 0.15s, transform 0.15s", position: "relative" }}
              onClick={() => { if (p.videoUrl) setPreviewProject(p); else onCreateNew(); }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 28px rgba(0,0,0,0.1)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
            >
              {/* サムネイル */}
              <div style={{ height: 170, background: p.gradient || "linear-gradient(135deg,#f06a28,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, position: "relative", overflow: "hidden" }}>
                {p.thumbnail
                  ? <img src={p.thumbnail} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />
                  : <span style={{ opacity: 0.6 }}>{p.emoji || "🎬"}</span>
                }
                {/* 動画がある場合は再生ボタンを表示 */}
                {p.videoUrl && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.25)" }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#1A202C"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  </div>
                )}
                {statusBadge(p)}
              </div>
              {/* 情報 */}
              <div style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: "#1A202C", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%" }}>{p.title}</h4>
                  <div style={{ position: "relative" }} data-menu-btn>
                    <button
                      data-menu-btn
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === p.id ? null : p.id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 6, color: "#94A3B8", fontSize: 18, lineHeight: 1 }}>⋯</button>
                    {menuOpen === p.id && (
                      <div data-menu-btn style={{ position: "absolute", right: 0, top: "100%", background: "#fff", border: "1px solid #EEF0F4", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 10, minWidth: 160, overflow: "hidden" }}>
                        {[
                          { label: "▶ 動画を再生", action: () => { setMenuOpen(null); if (p.videoUrl) setPreviewProject(p); }, disabled: !p.videoUrl },
                          { label: "⬇ ダウンロード", action: () => { if (p.videoUrl) { const a = document.createElement("a"); a.href = p.videoUrl; a.download = p.title + ".mp4"; a.click(); } setMenuOpen(null); }, disabled: !p.videoUrl },
                          { label: "複製", action: () => handleDuplicate(p) },
                          { label: "削除", action: () => { setDeleteConfirm(p.id); setMenuOpen(null); }, danger: true },
                        ].map((item, i) => (
                          <div key={i} onClick={e => { e.stopPropagation(); if (!item.disabled) item.action(); }}
                            style={{ padding: "9px 14px", fontSize: 12.5, fontWeight: 500, color: item.danger ? "#EF4444" : item.disabled ? "#CBD5E1" : "#334155", cursor: item.disabled ? "default" : "pointer", borderBottom: i < 3 ? "1px solid #F8F9FB" : "none" }}
                            onMouseEnter={e => { if (!item.disabled) e.currentTarget.style.background = "#F8F9FB"; }}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                          >{item.label}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#94A3B8" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#94A3B8"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/></svg>
                    {p.date}
                  </div>
                  {p.duration && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#94A3B8" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#94A3B8"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
                      {p.duration}
                    </div>
                  )}
                  {p.videoUrl && <span style={{ fontSize: 10, fontWeight: 700, color: "#22C55E", background: "#F0FDF4", padding: "2px 7px", borderRadius: 5 }}>動画あり</span>}
                </div>
              </div>
            </div>
          ))}

          {/* 新規作成カード */}
          <div onClick={onCreateNew} style={{ border: "2px dashed #D1D9E6", borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32, cursor: "pointer", minHeight: 260, transition: "border-color 0.15s, background 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#f06a28"; e.currentTarget.style.background = "#FFF8F4"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#D1D9E6"; e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#F1F3F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#94A3B8"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#334155", marginBottom: 4 }}>新規プロジェクト作成</div>
              <div style={{ fontSize: 12, color: "#94A3B8" }}>プロンプトやテキストから生成</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════
   MAIN APP
   ═══════════════ */
/* ═══════════════
   HOME PAGE
   ═══════════════ */
const HomePage = ({ onCreateNew, onStartFromTemplate, falApiKey, onSetApiKey, notifications, notifUnread, showNotif, onToggleNotif, onClearNotif, onGoProjects }) => {
  const [homeSearch, setHomeSearch] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const recentProjects = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem("sg_projects") || "[]");
      if (saved.length > 0) return saved.slice(0, 4).map(p => ({
        title: p.title,
        time: p.date,
        duration: p.duration || "5s",
        color: p.gradient || "#E8A44A",
        emoji: p.emoji || "🎬",
        videoUrl: p.videoUrl || null,
        thumbnail: p.thumbnail || null,
      }));
    } catch {}
    return [];
  })();

  const filteredRecentProjects = homeSearch.trim()
    ? recentProjects.filter(p => p.title.toLowerCase().includes(homeSearch.toLowerCase()))
    : recentProjects;
  const assets = (() => {
    try {
      const vis = JSON.parse(localStorage.getItem("sg_visual_assets") || "[]");
      const aud = JSON.parse(localStorage.getItem("sg_audio_assets") || "[]");
      const iconMap = { image: { icon: "image", iconColor: "#4F6EF7", iconBg: "#EEF2FF" }, video: { icon: "video_cam", iconColor: "#E55", iconBg: "#FEE" }, audio: { icon: "music_note", iconColor: "#22C55E", iconBg: "#DCFCE7" } };
      return [...vis, ...aud].slice(0, 5).map(a => ({
        name: a.name || "asset",
        type: a.type === "video" ? "動画" : a.type === "audio" ? "音声" : "画像",
        size: "--",
        date: a.date || "--",
        ...(iconMap[a.type] || iconMap.image),
      }));
    } catch { return []; }
  })();
  const storagePercent = Math.min(90, assets.length * 15);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#F8F9FB" }}>
      {/* トップバー */}
      <header style={{ height: 58, background: "#fff", borderBottom: "1px solid #EEF0F4", display: "flex", alignItems: "center", padding: "0 28px", gap: 16, flexShrink: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#1A202C", letterSpacing: "-0.03em", flex: 1 }}>Home</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#F4F6F9", border: "1px solid #E8EAF0", borderRadius: 10, padding: "7px 14px", width: 240 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="#94A3B8"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input value={homeSearch} onChange={e => setHomeSearch(e.target.value)} placeholder="Search projects..." style={{ border: "none", background: "transparent", outline: "none", fontSize: 12.5, color: "#333", fontFamily: "inherit", flex: 1 }} />
          {homeSearch && <svg onClick={() => setHomeSearch("")} width="13" height="13" viewBox="0 0 24 24" fill="#94A3B8" style={{ cursor: "pointer", flexShrink: 0 }}><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>}
        </div>
        {/* 🔑 FAL.ai APIキーボタン（常時表示） */}
        <button
          onClick={onSetApiKey}
          title={falApiKey ? "FAL.ai APIキー設定済み" : "FAL.ai APIキーを設定"}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${falApiKey ? "#16A34A" : "#E8EAF0"}`, background: falApiKey ? "#F0FDF4" : "#F4F6F9", cursor: "pointer", transition: "all 0.2s" }}
        >
          <span style={{ fontSize: 14 }}>🔑</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: falApiKey ? "#16A34A" : "#94A3B8" }}>
            {falApiKey ? "API設定済み" : "APIキー設定"}
          </span>
          {falApiKey && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#16A34A" }} />}
        </button>
        {/* ベルボタン → 通知パネル */}
        <div style={{ position: "relative" }} data-notif-panel="1">
          <div
            onClick={onToggleNotif}
            style={{ width: 34, height: 34, borderRadius: "50%", background: "#F4F6F9", border: "1px solid #E8EAF0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="#64748B"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
            {notifUnread > 0 && <div style={{ position: "absolute", top: 5, right: 5, width: 8, height: 8, borderRadius: "50%", background: "#f06a28", border: "1.5px solid #fff" }} />}
          </div>
          {showNotif && (
            <div style={{ position: "absolute", top: 42, right: 0, width: 320, background: "#fff", border: "1px solid #EEF0F4", borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,0.12)", zIndex: 200 }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #EEF0F4", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#1A202C" }}>通知</span>
                <span onClick={onClearNotif} style={{ fontSize: 11, color: "#f06a28", cursor: "pointer", fontWeight: 700 }}>すべて既読</span>
              </div>
              {notifications.length === 0 ? (
                <div style={{ padding: "28px 18px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>通知はありません</div>
              ) : notifications.map((n, i) => (
                <div key={i} style={{ padding: "12px 18px", borderBottom: i < notifications.length - 1 ? "1px solid #F8F9FB" : "none", display: "flex", gap: 12, background: n.unread ? "#FFFBF8" : "#fff" }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: n.color || "#F4F6F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>{n.icon}</div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1A202C", marginBottom: 2 }}>{n.title}</div>
                    <div style={{ fontSize: 11.5, color: "#64748B" }}>{n.body}</div>
                    <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 3 }}>{n.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div onClick={() => setShowHelp(true)} style={{ width: 34, height: 34, borderRadius: "50%", background: "#F4F6F9", border: "1px solid #E8EAF0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          title="ヘルプ・使い方"
          onMouseEnter={e => { e.currentTarget.style.background = "#EFF6FF"; e.currentTarget.style.borderColor = "#4F6EF7"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#F4F6F9"; e.currentTarget.style.borderColor = "#E8EAF0"; }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="#64748B"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>
        </div>
      </header>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {/* メインコンテンツ */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>

        {/* ウェルカム & クイックアクション */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A202C", marginBottom: 4, letterSpacing: "-0.03em" }}>おかえりなさい 👋</h1>
          <p style={{ fontSize: 13.5, color: "#64748B", marginBottom: 20 }}>お気に入りテンプレートからすぐに動画を作成しましょう</p>

          {/* お気に入りカード (最大3件) または デフォルト3件 */}
          {(() => {
            // お気に入りIDをlocalStorageから取得
            let favIds = [];
            try { favIds = JSON.parse(localStorage.getItem("sg_fav_templates") || "[]"); } catch {}

            // お気に入りがあればそのテンプレートデータ、なければデフォルト3件
            const DEFAULT_CARDS = [
              { id: "sale",    icon: "📢", iconBg: "#EFF6FF", title: "セール告知",          desc: "期間限定プロモーションに最適",       ctaColor: "#4F6EF7" },
              { id: "product", icon: "🎬", iconBg: "#FFF3EE", title: "製品イントロ",         desc: "洗練された製品プロモーション動画",   ctaColor: "#f06a28" },
              { id: "tips",    icon: "✨", iconBg: "#F5F3FF", title: "クイック Tips",        desc: "簡潔に伝える縦型ショート動画",       ctaColor: "#7C3AED" },
            ];
            const TEMPLATE_META = {
              product:  { icon: "🎬", iconBg: "#FFF3EE", ctaColor: "#f06a28" },
              sale:     { icon: "📢", iconBg: "#EFF6FF", ctaColor: "#4F6EF7" },
              tips:     { icon: "✨", iconBg: "#F5F3FF", ctaColor: "#7C3AED" },
              event:    { icon: "🎉", iconBg: "#FFF7ED", ctaColor: "#F59E0B" },
              howto:    { icon: "📖", iconBg: "#ECFDF5", ctaColor: "#10B981" },
              unboxing: { icon: "📦", iconBg: "#F0FDF4", ctaColor: "#22C55E" },
            };

            const cards = favIds.length > 0
              ? favIds.slice(0, 3).map(id => {
                  const tmpl = TEMPLATES.find(t => t.id === id);
                  const meta = TEMPLATE_META[id] || { icon: "⭐", iconBg: "#FFF3EE", ctaColor: "#f06a28" };
                  return { id, icon: meta.icon, iconBg: meta.iconBg, title: tmpl?.label || id, desc: tmpl?.desc || "", ctaColor: meta.ctaColor, isFav: true };
                })
              : DEFAULT_CARDS;

            const hasFavs = favIds.length > 0;

            return (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#64748B" }}>
                      {hasFavs ? `⭐ お気に入り (${favIds.length}件中 ${cards.length}件表示)` : "🔥 人気テンプレート"}
                    </span>
                  </div>
                  {!hasFavs && (
                    <span style={{ fontSize: 11.5, color: "#94A3B8" }}>⭐ を押してお気に入りを登録すると、ここに表示されます</span>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
                  {cards.map((card, i) => (
                    <div key={i} onClick={() => onStartFromTemplate(card.id)} style={{ background: "#fff", border: "1px solid #EEF0F4", borderRadius: 14, padding: 22, cursor: "pointer", transition: "box-shadow 0.15s, transform 0.15s", position: "relative" }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
                    >
                      {hasFavs && (
                        <div style={{ position: "absolute", top: 10, right: 10, fontSize: 12 }}>⭐</div>
                      )}
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: card.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 14 }}>{card.icon}</div>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: "#1A202C", marginBottom: 6, letterSpacing: "-0.01em" }}>{card.title}</div>
                      <div style={{ fontSize: 12.5, color: "#64748B", marginBottom: 14, lineHeight: 1.5 }}>{card.desc}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: card.ctaColor }}>今すぐ作成 →</div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>

        {/* 最近のプロジェクト */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontSize: 15.5, fontWeight: 700, color: "#1A202C", letterSpacing: "-0.02em" }}>Recent Projects</h2>
            <span onClick={() => onGoProjects && onGoProjects()} style={{ fontSize: 12.5, fontWeight: 600, color: "#f06a28", cursor: "pointer" }}>すべて見る →</span>
          </div>
          {homeSearch && filteredRecentProjects.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF0F4", padding: "32px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "#475569" }}>「{homeSearch}」に一致するプロジェクトはありません</div>
            </div>
          ) : filteredRecentProjects.length === 0 && !homeSearch ? (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px dashed #E2E8F0", padding: "40px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🎬</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#475569", marginBottom: 6 }}>まだプロジェクトがありません</div>
              <div style={{ fontSize: 12.5, color: "#94A3B8", marginBottom: 16 }}>最初の動画を生成するとここに表示されます</div>
              <button onClick={onCreateNew} style={{ padding: "9px 22px", background: "#f06a28", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ 最初の動画を作成</button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
              {filteredRecentProjects.map((proj, i) => (
                <div key={i} style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #EEF0F4", cursor: "pointer", transition: "box-shadow 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
                  onClick={() => proj.videoUrl && window.open(proj.videoUrl, "_blank")}
                >
                  <div style={{ height: 110, background: typeof proj.color === "string" && proj.color.startsWith("linear") ? proj.color : "#E8A44A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, position: "relative", overflow: "hidden" }}>
                    {proj.thumbnail
                      ? <img src={proj.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
                      : <span style={{ position: "relative", zIndex: 1 }}>{proj.emoji}</span>
                    }
                    {proj.videoUrl && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s" }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0}><svg width="32" height="32" viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)"><path d="M8 5v14l11-7z"/></svg></div>}
                    <div style={{ position: "absolute", bottom: 7, right: 8, background: "rgba(0,0,0,0.62)", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 4, padding: "2px 6px", letterSpacing: "0.04em" }}>{proj.duration}</div>
                  </div>
                  <div style={{ padding: "11px 13px" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1A202C", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{proj.title}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{proj.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 下段：アセット + ストレージ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
          {/* 最近のアセット */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF0F4", padding: "20px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1A202C" }}>最近追加したアセット</h3>
              <button style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#1A202C", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer" }}>アップロード</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "0 16px", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, paddingBottom: 8, borderBottom: "1px solid #F1F3F7" }}>名前</span>
              {["種類","サイズ","日付"].map(h => <span key={h} style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, paddingBottom: 8, borderBottom: "1px solid #F1F3F7", textAlign: "right" }}>{h}</span>)}
              {assets.map((a, i) => [
                <div key={`n${i}`} style={{ display: "flex", alignItems: "center", gap: 9, paddingTop: 12, paddingBottom: i < assets.length-1 ? 12 : 0, borderBottom: i < assets.length-1 ? "1px solid #F8F9FB" : "none" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: a.iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name={a.icon} size={14} color={a.iconColor} />
                  </div>
                  <span style={{ fontSize: 12.5, color: "#334155", fontWeight: 500 }}>{a.name}</span>
                </div>,
                ...[a.type, a.size, a.date].map((v, j) => <span key={`v${i}${j}`} style={{ fontSize: 12, color: "#64748B", textAlign: "right", paddingTop: 12, paddingBottom: i < assets.length-1 ? 12 : 0, borderBottom: i < assets.length-1 ? "1px solid #F8F9FB" : "none" }}>{v}</span>),
              ])}
            </div>
          </div>

          {/* ストレージ */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF0F4", padding: "20px 22px", display: "flex", flexDirection: "column" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1A202C", marginBottom: 16 }}>ストレージ使用量</h3>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#f06a28" }}>使用中</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#f06a28" }}>{storagePercent}%</span>
            </div>
            <div style={{ height: 7, background: "#F1F3F7", borderRadius: 99, marginBottom: 8, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${storagePercent}%`, background: "linear-gradient(90deg, #f06a28, #e8420a)", borderRadius: 99 }} />
            </div>
            <p style={{ fontSize: 12, color: "#64748B", marginBottom: "auto" }}>3.25 GB / 5.0 GB を使用しています</p>
            <div style={{ background: "#FFF8F4", border: "1px solid #FFE0CC", borderRadius: 10, padding: "13px 14px", marginTop: 20 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#f06a28", marginBottom: 5 }}>Proプランにアップグレード</div>
              <p style={{ fontSize: 11.5, color: "#78716C", marginBottom: 12, lineHeight: 1.5 }}>容量を増やして、4K書き出しなどの機能を利用しましょう。</p>
              <button onClick={() => {}} style={{ width: "100%", padding: "8px", background: "#f06a28", color: "#fff", border: "none", borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                プランを見る
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


/* ═══════════════
   ASSETS PAGE
   ═══════════════ */
const AssetsPage = ({ onUseInProject }) => {
  const [activeTab, setActiveTab] = useState("all");
  const [menuOpen, setMenuOpen] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [previewAsset, setPreviewAsset] = useState(null); // 画像/動画プレビュー
  const fileUploadRef = useRef();

  // sg_projectsから生成済み動画をアセットとして取り込む
  const generatedAssets = (() => {
    try {
      const projs = JSON.parse(localStorage.getItem("sg_projects") || "[]");
      return projs
        .filter(p => p.videoUrl)
        .map(p => ({
          id: "proj_" + p.id,
          name: (p.title || "動画") + ".mp4",
          size: "—",
          date: p.date || "",
          type: "video",
          bg: p.gradient || "linear-gradient(135deg,#f06a28,#7C3AED)",
          emoji: "🎬",
          dataUrl: p.videoUrl,
          thumbnail: p.thumbnail || null,
          isGenerated: true,
        }));
    } catch { return []; }
  })();

  const [uploadedVisual, setUploadedVisual] = useState(() => {
    try { const s = localStorage.getItem("sg_visual_assets"); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [audioAssets, setAudioAssets] = useState(() => {
    try { const s = localStorage.getItem("sg_audio_assets"); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  // 生成済み動画 + アップロード済みを合計
  const visualAssets = [...generatedAssets, ...uploadedVisual];

  const saveVisual = (v) => { setUploadedVisual(v); try { localStorage.setItem("sg_visual_assets", JSON.stringify(v)); } catch {} };
  const saveAudio = (a) => { setAudioAssets(a); try { localStorage.setItem("sg_audio_assets", JSON.stringify(a)); } catch {} };

  const handleDeleteAsset = (id) => {
    saveVisual(uploadedVisual.filter(a => a.id !== id));
    saveAudio(audioAssets.filter(a => a.id !== id));
    setDeleteConfirm(null);
  };

  const handleFileUpload = async (files) => {
    const newAssets = [];
    for (const f of Array.from(files).slice(0, 10)) {
      const isImg = f.type.startsWith("image/");
      const isAudio = f.type.startsWith("audio/");
      const isVideo = f.type.startsWith("video/");
      const sizeMB = (f.size / (1024*1024)).toFixed(1);
      if (isImg || isVideo) {
        const dataUrl = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
        newAssets.push({ id: Date.now() + Math.random(), name: f.name, size: sizeMB + " MB", date: new Date().toLocaleDateString("ja-JP"), type: isImg ? "image" : "video", bg: "linear-gradient(135deg, #f06a28, #e8420a)", emoji: isImg ? "🖼️" : "🎬", dataUrl });
      } else if (isAudio) {
        const newId = Date.now() + Math.random();
        saveAudio([...audioAssets, { id: newId, name: f.name, size: sizeMB + " MB", duration: "—", date: new Date().toLocaleDateString("ja-JP") }]);
        continue;
      }
    }
    if (newAssets.length > 0) saveVisual([...newAssets, ...uploadedVisual]);
  };

  const sq = searchQuery.toLowerCase();
  const filteredVisual = visualAssets.filter(a => {
    const matchTab = activeTab === "all" ? true : activeTab === "images" ? a.type === "image" : activeTab === "videos" ? a.type === "video" : false;
    const matchSearch = !sq || a.name.toLowerCase().includes(sq);
    return matchTab && matchSearch;
  });
  const filteredAudio = (activeTab === "all" || activeTab === "music") ? audioAssets.filter(a => !sq || a.name.toLowerCase().includes(sq)) : [];

  const ThreeDotMenu = ({ id }) => (
    <div style={{ position: "relative" }}>
      <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === id ? null : id); }}
        style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "#94A3B8", display: "flex", alignItems: "center", borderRadius: 6 }}
        onMouseEnter={e => e.currentTarget.style.color = "#475569"}
        onMouseLeave={e => e.currentTarget.style.color = "#94A3B8"}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
      </button>
      {menuOpen === id && (
        <div style={{ position: "absolute", right: 0, top: "100%", zIndex: 100, background: "#fff", border: "1px solid #EEF0F4", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 130, padding: 4 }}>
          {[["🎬","動画生成に使用"],["✏️","名前変更"],["📤","ダウンロード"],["🗑️","削除"]].map(([icon, label]) => (
            <button key={label} onClick={(e) => { e.stopPropagation(); if (label === "削除") { setDeleteConfirm(id); } else if (label === "動画生成に使用") { const asset = [...visualAssets, ...audioAssets].find(a => a.id === id); if (asset && onUseInProject) onUseInProject(asset); } setMenuOpen(null); }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 12px", background: "none", border: "none", fontSize: 12.5, color: label === "削除" ? "#EF4444" : "#334155", cursor: "pointer", borderRadius: 7, textAlign: "left" }}
              onMouseEnter={e => e.currentTarget.style.background = "#F8F9FB"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}
            >{icon} {label}</button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#F8F9FB" }}>
      {/* 画像/動画プレビューモーダル */}
      {previewAsset && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14 }}
          onClick={() => setPreviewAsset(null)}>
          <div style={{ background: "#111", borderRadius: 16, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", position: "relative" }}
            onClick={e => e.stopPropagation()}>
            {previewAsset.type === "video"
              ? <video src={previewAsset.dataUrl} controls autoPlay muted loop style={{ display: "block", maxHeight: "75vh", maxWidth: "85vw" }} />
              : <img src={previewAsset.dataUrl} alt={previewAsset.name} style={{ display: "block", maxHeight: "75vh", maxWidth: "85vw", objectFit: "contain" }} />
            }
            <div style={{ position: "absolute", top: 8, right: 8 }}>
              <button onClick={() => setPreviewAsset(null)} style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", cursor: "pointer", color: "#fff", fontSize: 16 }}>✕</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <a href={previewAsset.dataUrl} download={previewAsset.name}
              style={{ padding: "10px 22px", borderRadius: 9, border: "none", background: "#f06a28", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              ⬇ ダウンロード
            </a>
            {onUseInProject && (
              <button onClick={() => { onUseInProject(previewAsset); setPreviewAsset(null); }}
                style={{ padding: "10px 18px", borderRadius: 9, border: "none", background: "#7C3AED", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                🎬 動画生成に使用
              </button>
            )}
            <button onClick={() => setPreviewAsset(null)}
              style={{ padding: "10px 18px", borderRadius: 9, border: "1.5px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              閉じる
            </button>
          </div>
        </div>
      )}
      {/* 削除確認 */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 24, width: 340, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1A202C", marginBottom: 8 }}>アセットを削除しますか？</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: "7px 18px", border: "1px solid #e0e0e0", borderRadius: 8, background: "#fff", fontSize: 13, fontWeight: 600, color: "#555", cursor: "pointer" }}>キャンセル</button>
              <button onClick={() => handleDeleteAsset(deleteConfirm)} style={{ padding: "7px 18px", border: "none", borderRadius: 8, background: "#EF4444", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>削除</button>
            </div>
          </div>
        </div>
      )}
      {/* ファイル入力（非表示） */}
      <input ref={fileUploadRef} type="file" multiple accept="image/*,video/*,audio/*" style={{ display: "none" }} onChange={e => { handleFileUpload(e.target.files); e.target.value = ""; }} />
      {/* トップバー */}
      <header style={{ height: 58, background: "#fff", borderBottom: "1px solid #EEF0F4", display: "flex", alignItems: "center", padding: "0 28px", gap: 16, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#F4F6F9", border: "1px solid #E8EAF0", borderRadius: 10, padding: "7px 14px", flex: 1, maxWidth: 380 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="#94A3B8"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="アセットを検索..." style={{ border: "none", background: "transparent", outline: "none", fontSize: 12.5, color: "#333", fontFamily: "inherit", flex: 1 }} />
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => fileUploadRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", background: "#f06a28", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(240,106,40,0.3)" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
          アセットをアップロード
        </button>
      </header>

      {/* メインコンテンツ */}
      <div style={{ flex: 1, overflowY: "auto", padding: "32px 36px" }} onClick={() => setMenuOpen(null)}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1A202C", letterSpacing: "-0.03em", marginBottom: 22 }}>Assets</h1>
        {/* タブ */}
        <div style={{ display: "flex", borderBottom: "1px solid #E8EAF0", marginBottom: 32 }}>
          {[["all","すべて"],["images","画像"],["videos","動画"],["music","音楽"]].map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{ padding: "10px 22px", background: "none", border: "none", borderBottom: activeTab === id ? "2.5px solid #f06a28" : "2.5px solid transparent", fontSize: 13.5, fontWeight: activeTab === id ? 700 : 500, color: activeTab === id ? "#f06a28" : "#64748B", cursor: "pointer", transition: "all 0.15s", marginBottom: -1 }}>
              {label}
            </button>
          ))}
        </div>

        {/* ビジュアルアセットが空の場合 */}
        {filteredVisual.length === 0 && filteredAudio.length === 0 && (
          <div style={{ textAlign: "center", padding: "64px 24px", background: "#fff", borderRadius: 16, border: "1px dashed #D1D9E6" }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>🖼️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#334155", marginBottom: 6 }}>アセットがありません</div>
            <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 20 }}>動画を生成するか、ファイルをアップロードしてください</div>
            <button onClick={() => fileUploadRef.current?.click()}
              style={{ padding: "10px 24px", background: "#f06a28", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              ファイルをアップロード
            </button>
          </div>
        )}

        {/* ビジュアルアセット */}
        {filteredVisual.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Visual Assets</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20 }}>
              {filteredVisual.map(asset => (
                <div key={asset.id}
                  style={{ background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #EEF0F4", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", transition: "box-shadow 0.15s, transform 0.15s", cursor: "pointer" }}
                  onClick={() => asset.dataUrl && setPreviewAsset(asset)}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.09)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)"; e.currentTarget.style.transform = "none"; }}
                >
                  {/* サムネイル */}
                  <div style={{ paddingBottom: "56.25%", position: "relative", background: asset.bg || "linear-gradient(135deg,#f06a28,#7C3AED)", overflow: "hidden" }}>
                    {/* 実際の画像/動画サムネイル表示 */}
                    {asset.thumbnail
                      ? <img src={asset.thumbnail} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />
                      : asset.type === "image" && asset.dataUrl
                        ? <img src={asset.dataUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42, opacity: 0.65 }}>{asset.emoji}</div>
                    }
                    {/* 生成済みバッジ */}
                    {asset.isGenerated && (
                      <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(240,106,40,0.9)", borderRadius: 5, padding: "2px 8px", fontSize: 9, fontWeight: 700, color: "#fff" }}>AI生成</div>
                    )}
                    {/* ホバーオーバーレイ（動画のみ再生マーク表示） */}
                    {asset.type === "video" ? (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.18)" }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="#1A202C"><path d="M8 5v14l11-7z"/></svg>
                        </div>
                      </div>
                    ) : (
                      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0)", transition: "background 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.12)"}
                        onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0)"}
                      />
                    )}
                    {asset.duration && (
                      <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 4, padding: "2px 6px" }}>{asset.duration}</div>
                    )}
                  </div>
                  {/* カード下部 */}
                  <div style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1A202C", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, paddingRight: 6 }}>{asset.name}</span>
                      <div onClick={e => e.stopPropagation()}>
                        <ThreeDotMenu id={asset.id} />
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#94A3B8" }}>
                      <span>{asset.type === "video" ? "🎬 動画" : "🖼️ 画像"}</span>
                      {asset.size && asset.size !== "—" && <>
                        <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#CBD5E1", flexShrink: 0 }} />
                        <span>{asset.size}</span>
                      </>}
                      {asset.date && <>
                        <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#CBD5E1", flexShrink: 0 }} />
                        <span>{asset.date}</span>
                      </>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* オーディオアセット */}
        {filteredAudio.length > 0 && (
          <section>
            <h3 style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Audio Assets</h3>
            <div style={{ background: "#fff", border: "1px solid #EEF0F4", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              {/* テーブルヘッダー */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 120px 60px", background: "#F8F9FB", borderBottom: "1px solid #EEF0F4", padding: "12px 20px" }}>
                {["ファイル名","サイズ","長さ","アップロード日","操作"].map((h, i) => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", textAlign: i === 4 ? "right" : "left" }}>{h}</span>
                ))}
              </div>
              {/* 行 */}
              {filteredAudio.map((audio, idx) => (
                <div key={audio.id} style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 120px 60px", padding: "14px 20px", borderBottom: idx < filteredAudio.length - 1 ? "1px solid #F1F3F7" : "none", alignItems: "center", transition: "background 0.12s", cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#FAFBFC"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  {/* ファイル名 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "#FFF3EE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}
                      onClick={() => setPlaying(playing === audio.id ? null : audio.id)}
                    >
                      {playing === audio.id
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#f06a28"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="#f06a28"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                      }
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{audio.name}</span>
                  </div>
                  <span style={{ fontSize: 12.5, color: "#64748B" }}>{audio.size}</span>
                  <span style={{ fontSize: 12.5, color: "#64748B" }}>{audio.duration}</span>
                  <span style={{ fontSize: 12.5, color: "#64748B" }}>{audio.date}</span>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <ThreeDotMenu id={audio.id} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

/* ═══════════════
   SETTINGS PAGE
   ═══════════════ */
const SettingsPage = ({ userName, onUserNameChange, claudeApiKey, onClaudeApiKeyChange }) => {
  const [name, setName] = useState(userName || "Username");
  const [email, setEmail] = useState(() => { try { return localStorage.getItem("sg_email") || "user@example.com"; } catch { return "user@example.com"; } });
  const [defaultVoice, setDefaultVoice] = useState(() => { try { return localStorage.getItem("sg_voice") || "naoto"; } catch { return "naoto"; } });
  const [aspectRatio, setAspectRatio] = useState(() => { try { return localStorage.getItem("sg_aspectRatio") || "9:16"; } catch { return "9:16"; } });
  const [language, setLanguage] = useState(() => { try { return localStorage.getItem("sg_language") || "ja"; } catch { return "ja"; } });
  const [emailNotif, setEmailNotif] = useState(() => { try { return localStorage.getItem("sg_emailNotif") !== "false"; } catch { return true; } });
  const [projectNotif, setProjectNotif] = useState(() => { try { return localStorage.getItem("sg_projectNotif") !== "false"; } catch { return true; } });
  const [claudeKey, setClaudeKey] = useState(claudeApiKey || "");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    if (onUserNameChange) onUserNameChange(name);
    if (onClaudeApiKeyChange) onClaudeApiKeyChange(claudeKey);
    try {
      localStorage.setItem("sg_email", email);
      localStorage.setItem("sg_voice", defaultVoice);
      localStorage.setItem("sg_aspectRatio", aspectRatio);
      localStorage.setItem("sg_language", language);
      localStorage.setItem("sg_emailNotif", String(emailNotif));
      localStorage.setItem("sg_projectNotif", String(projectNotif));
    } catch {}
    setTimeout(() => setSaved(false), 2000);
  };

  const inputStyle = { width: "100%", padding: "9px 13px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 13.5, color: "#1A202C", background: "#fff", outline: "none", fontFamily: "inherit", transition: "border-color 0.15s" };
  const labelStyle = { fontSize: 12.5, fontWeight: 700, color: "#475569", marginBottom: 6, display: "block" };
  const cardStyle = { background: "#fff", border: "1px solid #EEF0F4", borderRadius: 14, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" };

  const Toggle = ({ checked, onChange }) => (
    <div onClick={() => onChange(!checked)} style={{ width: 44, height: 24, borderRadius: 99, background: checked ? "#f06a28" : "#CBD5E1", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 2, left: checked ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s" }} />
    </div>
  );

  const selectStyle = { ...inputStyle, appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='%2394A3B8'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#F8F9FB" }}>
      <header style={{ height: 58, background: "#fff", borderBottom: "1px solid #EEF0F4", display: "flex", alignItems: "center", padding: "0 32px", flexShrink: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#1A202C", letterSpacing: "-0.03em", flex: 1 }}>Settings</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1A202C" }}>{name}</div>
            <div style={{ fontSize: 10.5, color: "#94A3B8" }}>Pro Plan</div>
          </div>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #f06a28, #e8420a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>{name.charAt(0)}</div>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "36px 48px 60px" }}>
        <div style={{ maxWidth: 780 }}>
          <div style={{ marginBottom: 36 }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: "#1A202C", letterSpacing: "-0.03em", marginBottom: 6 }}>設定</h1>
            <p style={{ fontSize: 13.5, color: "#64748B" }}>アカウント、支払い、および生成の基本設定を管理します。</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
            {/* プロフィール */}
            <section>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#1A202C", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#f06a28"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                プロフィール
              </h3>
              <div style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 28 }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{ width: 82, height: 82, borderRadius: "50%", background: "linear-gradient(135deg, #f06a28, #7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: "#fff", border: "3px solid #EEF0F4" }}>{name.charAt(0)}</div>
                    <div style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: "50%", background: "#f06a28", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff", cursor: "pointer" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff"><path d="M12 15.2A3.2 3.2 0 0 1 8.8 12 3.2 3.2 0 0 1 12 8.8 3.2 3.2 0 0 1 15.2 12 3.2 3.2 0 0 1 12 15.2M20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/></svg>
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: 14.5, fontWeight: 700, color: "#1A202C", marginBottom: 4 }}>画像をアップロード</p>
                    <p style={{ fontSize: 12, color: "#94A3B8", marginBottom: 12 }}>JPG、PNG形式。最大サイズ 2MB</p>
                    <button style={{ padding: "7px 16px", background: "#F4F6F9", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12.5, fontWeight: 700, color: "#475569", cursor: "pointer" }}>変更する</button>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                  <div>
                    <label style={labelStyle}>名前</label>
                    <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} onFocus={e => e.target.style.borderColor="#f06a28"} onBlur={e => e.target.style.borderColor="#E2E8F0"} />
                  </div>
                  <div>
                    <label style={labelStyle}>メールアドレス</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} onFocus={e => e.target.style.borderColor="#f06a28"} onBlur={e => e.target.style.borderColor="#E2E8F0"} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>パスワード</label>
                    <div style={{ display: "flex", gap: 10 }}>
                      <input type="password" defaultValue="••••••••••••" style={{ ...inputStyle, flex: 1 }} onFocus={e => e.target.style.borderColor="#f06a28"} onBlur={e => e.target.style.borderColor="#E2E8F0"} />
                      <button style={{ padding: "9px 20px", border: "1.5px solid #E2E8F0", borderRadius: 8, background: "#fff", fontSize: 13, fontWeight: 700, color: "#475569", cursor: "pointer", whiteSpace: "nowrap" }}>変更</button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* プランと支払い */}
            <section>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#1A202C", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#f06a28"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>
                プランと支払い
              </h3>
              <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "20px 28px", borderBottom: "1px solid #F1F3F7", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: "#f06a28", letterSpacing: "0.1em", textTransform: "uppercase" }}>Current Plan</span>
                      <span style={{ fontSize: 9.5, fontWeight: 800, color: "#16A34A", background: "#DCFCE7", borderRadius: 99, padding: "2px 8px", letterSpacing: "0.06em" }}>ACTIVE</span>
                    </div>
                    <p style={{ fontSize: 20, fontWeight: 900, color: "#1A202C", letterSpacing: "-0.02em" }}>Pro Plan</p>
                  </div>
                  <button style={{ padding: "10px 22px", background: "#f06a28", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 3px 10px rgba(240,106,40,0.3)" }}>プランをアップグレード</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "22px 28px", gap: 24 }}>
                  {[
                    { icon: "M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z", title: "請求サイクル", desc: "月額払い (次回請求: 2024年11月12日)", action: null },
                    { icon: "M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z", title: "支払い方法", desc: "Visa ending in 4242", action: "編集" },
                  ].map(item => (
                    <div key={item.title} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: "#F8F9FB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#94A3B8"><path d={item.icon}/></svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#1A202C" }}>{item.title}</p>
                          {item.action && <span style={{ fontSize: 11.5, fontWeight: 700, color: "#f06a28", cursor: "pointer" }}>{item.action}</span>}
                        </div>
                        <p style={{ fontSize: 12.5, color: "#64748B" }}>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* AI生成設定 */}
            <section>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#1A202C", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#f06a28"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/></svg>
                AI生成設定
              </h3>
              <div style={cardStyle}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                  <div>
                    <label style={labelStyle}>デフォルト音声</label>
                    <select value={defaultVoice} onChange={e => setDefaultVoice(e.target.value)} style={selectStyle} onFocus={e => e.target.style.borderColor="#f06a28"} onBlur={e => e.target.style.borderColor="#E2E8F0"}>
                      <option value="naoto">ナオト (落ち着いた男性)</option>
                      <option value="misaki">ミサキ (明るい女性)</option>
                      <option value="kenji">ケンジ (力強い男性)</option>
                      <option value="haruka">ハルカ (優しい女性)</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>デフォルト アスペクト比</label>
                    <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} style={selectStyle} onFocus={e => e.target.style.borderColor="#f06a28"} onBlur={e => e.target.style.borderColor="#E2E8F0"}>
                      <option value="9:16">9:16 (TikTok / Shorts)</option>
                      <option value="16:9">16:9 (YouTube)</option>
                      <option value="1:1">1:1 (Instagram)</option>
                      <option value="4:5">4:5 (Facebook)</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>優先言語</label>
                    <select value={language} onChange={e => setLanguage(e.target.value)} style={selectStyle} onFocus={e => e.target.style.borderColor="#f06a28"} onBlur={e => e.target.style.borderColor="#E2E8F0"}>
                      <option value="ja">日本語</option>
                      <option value="en">English</option>
                      <option value="zh">中文</option>
                    </select>
                  </div>
                </div>
              </div>
            </section>

            {/* APIキー */}
            <section>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#1A202C", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#f06a28"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h3v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
                APIキー設定
              </h3>
              <div style={cardStyle}>
                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>Claude APIキー</label>
                  <input type="password" value={claudeKey} onChange={e => setClaudeKey(e.target.value)} placeholder="sk-ant-..." style={inputStyle} onFocus={e => e.target.style.borderColor="#f06a28"} onBlur={e => e.target.style.borderColor="#E2E8F0"} />
                  <p style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 6, lineHeight: 1.5 }}>商品分析・コピー生成に使用されます。キーはブラウザのローカルストレージに保存され、Anthropic APIへ直接送信されます。</p>
                </div>
                <p style={{ fontSize: 11.5, color: "#64748B", lineHeight: 1.5 }}>※ FAL.ai APIキーはエディタ画面の動画生成時に設定できます。</p>
              </div>
            </section>

            {/* 通知 */}
            <section>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#1A202C", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#f06a28"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
                通知
              </h3>
              <div style={{ ...cardStyle, padding: 0 }}>
                {[
                  { label: "メール通知", desc: "新しいアップデートや機能に関するメールを受け取る", checked: emailNotif, onChange: setEmailNotif },
                  { label: "プロジェクト完了通知", desc: "動画の生成が完了した際にデスクトップ通知を受け取る", checked: projectNotif, onChange: setProjectNotif },
                ].map((item, i, arr) => (
                  <div key={item.label} style={{ padding: "20px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: i < arr.length - 1 ? "1px solid #F1F3F7" : "none" }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#1A202C", marginBottom: 3 }}>{item.label}</p>
                      <p style={{ fontSize: 12.5, color: "#64748B" }}>{item.desc}</p>
                    </div>
                    <Toggle checked={item.checked} onChange={item.onChange} />
                  </div>
                ))}
              </div>
            </section>

            {/* 保存ボタン */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, paddingTop: 8 }}>
              <button onClick={() => { setName(userName || "Username"); setSaved(false); }} style={{ padding: "10px 28px", border: "1.5px solid #E2E8F0", borderRadius: 10, background: "#fff", fontSize: 13.5, fontWeight: 700, color: "#475569", cursor: "pointer" }}>キャンセル</button>
              <button onClick={handleSave} style={{ padding: "10px 28px", background: saved ? "#16A34A" : "#f06a28", color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 3px 12px rgba(240,106,40,0.3)", transition: "background 0.2s", display: "flex", alignItems: "center", gap: 7 }}>
                {saved ? <><svg width="15" height="15" viewBox="0 0 24 24" fill="#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>保存しました！</> : "設定を保存"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function MainApp({ user, onLogout }) {
  const [step, setStep] = useState(1);
  const [navPage, setNavPage] = useState("home");
  const [template, setTemplate] = useState(() => { try { return localStorage.getItem("sg_template") || null; } catch { return null; } });
  const [platform, setPlatform] = useState(() => { try { return localStorage.getItem("sg_platform") || "tiktok"; } catch { return "tiktok"; } });
  const [url, setUrl] = useState(() => { try { return localStorage.getItem("sg_url") || ""; } catch { return ""; } });
  const [urlErr, setUrlErr] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [product, setProduct] = useState(() => { try { const s = localStorage.getItem("sg_product"); return s ? JSON.parse(s) : null; } catch { return null; } });
  const [images, setImages] = useState([]);
  const [modelImages, setModelImages] = useState([]);
  const [prompt, setPrompt] = useState(() => { try { return localStorage.getItem("sg_prompt") || ""; } catch { return ""; } });
  const [showPrompt, setShowPrompt] = useState(false);
  const [aiModel, setAiModel] = useState(() => { try { return localStorage.getItem("sg_aiModel") || "kling3"; } catch { return "kling3"; } });
  const [variation, setVariation] = useState("luxury");
  const [copies, setCopies] = useState(["","",""]);
  const [bgm, setBgm] = useState(0);
  const [voice, setVoice] = useState(0);
  const [titleText, setTitleText] = useState("");
  const [selectedFont, setSelectedFont] = useState("noto");
  const [subtitlePreset, setSubtitlePreset] = useState("Standard");
  const [transitionPreset, setTransitionPreset] = useState("Dynamic cut");
  const [overlayPreset, setOverlayPreset] = useState("None");
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [genError, setGenError] = useState("");
  // ── 動画品質コントロール（競合差別化機能） ──
  const [cameraMove, setCameraMove] = useState("slow-push");
  const [motionStrength, setMotionStrength] = useState(0.3);
  const [negativePrompt, setNegativePrompt] = useState("blurry, distorted, watermark, text overlay, extra limbs, artifacts, low quality, english text, random letters, non-japanese characters, partial product, missing product, cut off product, wrong product, floating text, subtitle artifacts, morphing product, product transformation, changing product shape, different product, product inconsistency, product mutation, deformed product, abstract product");
  const [videoDuration, setVideoDuration] = useState("5");
  const [lightingStyle, setLightingStyle] = useState("studio");
  const [aiPromptMode, setAiPromptMode] = useState("auto");
  const [finalPromptPreview, setFinalPromptPreview] = useState("");
  const [copyGenerating, setCopyGenerating] = useState(false);

  // localStorageへの自動保存
  const setTemplatePersist = (v) => { setTemplate(v); try { localStorage.setItem("sg_template", v || ""); } catch {} };
  const setPlatformPersist = (v) => { setPlatform(v); try { localStorage.setItem("sg_platform", v); } catch {} };
  const setUrlPersist = (v) => { setUrl(v); try { localStorage.setItem("sg_url", v); } catch {} };
  const setPromptPersist = (v) => { setPrompt(v); try { localStorage.setItem("sg_prompt", v); } catch {} };
  const setAiModelPersist = (v) => { setAiModel(v); try { localStorage.setItem("sg_aiModel", v); } catch {} };
  const setProductPersist = (v) => { setProduct(v); try { localStorage.setItem("sg_product", v ? JSON.stringify(v) : ""); } catch {} };

  // Fal.ai 関連
  const [falApiKey, setFalApiKey] = useState(() => { try { return localStorage.getItem("sg_falApiKey") || ""; } catch { return ""; } });
  const [claudeApiKey, setClaudeApiKey] = useState(() => { try { return localStorage.getItem("sg_claudeApiKey") || ""; } catch { return ""; } });
  const setClaudeApiKeyPersist = (key) => { setClaudeApiKey(key); try { localStorage.setItem("sg_claudeApiKey", key); } catch {} };
  const [showApiModal, setShowApiModal] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState(null);
  // 動画生成に使うソース画像（null=自動選択=商品画像優先）
  const [selectedVideoImg, setSelectedVideoImg] = useState(null);

  // ユーザー名（Settings↔サイドバー連動）
  const [userName, setUserName] = useState(() => { try { return localStorage.getItem("sg_userName") || "Username"; } catch { return "Username"; } });
  const handleUserNameChange = (n) => { setUserName(n); try { localStorage.setItem("sg_userName", n); } catch {} };

  // 通知
  const [notifications, setNotifications] = useState([
    { icon: "🎬", color: "#FFF3EE", title: "動画生成の使い方", body: "商品画像をアップロードして最初の動画を作成しましょう", time: "たった今", unread: true },
    { icon: "✨", color: "#F5F3FF", title: "新機能：Kling 3.0対応", body: "最新モデルで高品質な動画生成が可能になりました", time: "1時間前", unread: true },
    { icon: "💡", color: "#EFF6FF", title: "ヒント", body: "⭐ を押してお気に入りテンプレートを登録できます", time: "昨日", unread: false },
  ]);
  const [showNotif, setShowNotif] = useState(false);
  const notifUnread = notifications.filter(n => n.unread).length;
  const handleToggleNotif = () => setShowNotif(v => !v);
  const handleClearNotif = () => { setNotifications(ns => ns.map(n => ({ ...n, unread: false }))); };

  // 通知パネルを外クリックで閉じる
  useEffect(() => {
    if (!showNotif) return;
    const handler = (e) => {
      if (!e.target.closest("[data-notif-panel]")) setShowNotif(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotif]);
  const [isRealGenerating, setIsRealGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState("");

  const handleAnalyze = async () => {
    const u = url.trim();
    if (!u) return;
    if (!u.startsWith("http")) { setUrlErr("http/https で始まるURLを入力してください"); return; }
    setUrlErr(""); setAnalyzing(true); setProductPersist(null);
    try {
      const tmpl = TEMPLATES.find(t=>t.id===template);
      const info = await callAI(u, tmpl?.label||"製品イントロ", claudeApiKey, platform);
      setProductPersist(info);
      setCopies(VARIATIONS.map(()=>`${info.mainCopy||""}\n${info.subCopy||""}`));
      if (info.titleText) setTitleText(info.titleText);
      if (info.recommendedVoice!=null) setVoice(info.recommendedVoice);
    } catch(e) {
      const msg = e.message || "";
      if (msg.includes("401") || msg.includes("API")) setUrlErr("APIキーに問題があります。設定を確認してください。");
      else if (msg.includes("timeout") || msg.includes("network") || msg.includes("Failed to fetch")) setUrlErr("接続タイムアウト。ネットワーク環境を確認して再試行してください。");
      else if (msg.includes("CORS") || msg.includes("blocked")) setUrlErr("URLへのアクセスがブロックされました。別のURLをお試しください。");
      else setUrlErr("解析に失敗しました。URLを確認して再試行してください。");
    } finally { setAnalyzing(false); }
  };

  // AIコピー生成（商品情報からキャッチコピーを生成）
  const handleGenerateCopy = async () => {
    if (!product) return;
    setCopyGenerating(true);
    try {
      if (!claudeApiKey) { setCopyGenerating(false); return; }
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": claudeApiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 800,
          messages: [{
            role: "user",
            content: `あなたは日本のSNS動画マーケティング専門家です。以下の商品情報をもとに、購買欲を最大化するSNS縦型動画用キャッチコピーを3パターン生成してください。

【商品情報】
商品名: ${product.productName}
カテゴリ: ${product.category}
価格: ${product.price}
ターゲット: ${product.target}
商品特徴: ${(product.features||[]).join(" / ") || "情報なし"}
顧客の声: ${(product.ugcPoints||[]).join(" / ") || "情報なし"}
レビュー傾向: ${product.reviewSummary || "情報なし"}

【コピー生成ルール】
・メインコピー: 10文字以内の強いキャッチフレーズ（動詞で終わる or 感嘆形）
・サブコピー: 20〜30文字の具体的ベネフィット（数字・口コミ要素を活かす）
・3パターンは「感情訴求」「機能訴求」「価格・お得訴求」で異なるアプローチ
・漢字・ひらがな・カタカナを正しく使用すること

必ずJSON配列のみで返してください:
[{"main":"...","sub":"..."},{"main":"...","sub":"..."},{"main":"...","sub":"..."}]`
          }]
        })
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "[]";
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const candidates = JSON.parse(match[0]);
        if (candidates.length > 0) {
          const newCopies = VARIATIONS.map((_, i) => {
            const c = candidates[i % candidates.length];
            return `${c.main}\n${c.sub}`;
          });
          setCopies(newCopies);
          if (candidates[0]?.main) setTitleText(candidates[0].main);
        }
      }
    } catch(e) {
      console.error("コピー生成エラー:", e);
    } finally { setCopyGenerating(false); }
  };

  // モックアニメーション（APIキーなし時）
  const mockTimersRef = useRef([]);
  const handleGenerateMock = () => {
    mockTimersRef.current.forEach(clearTimeout);
    mockTimersRef.current = [];
    setGenerating(true); setGenStep(0); setGenError("");
    AI_STEPS.forEach((_,i)=>{
      const tid = setTimeout(()=>{
        setGenStep(i);
        if(i===AI_STEPS.length-1) {
          const tid2 = setTimeout(()=>setGenerating(false),1100);
          mockTimersRef.current.push(tid2);
        }
      }, i*1200);
      mockTimersRef.current.push(tid);
    });
  };

  // 実際のFal.ai動画生成
  const handleRealGenerate = async () => {
    // 優先順位: ユーザー選択 → 商品画像 → モデル画像
    const mainImg = selectedVideoImg || images[0]?.url || modelImages[0]?.url;
    if (!mainImg) { setGenError("画像をアップロードしてください"); return; }

    setIsRealGenerating(true); setGenerating(true); setGenStep(0); setGenError(""); setGeneratedVideoUrl(null);

    // プログレス演出
    const progressMessages = [
      "Fal.ai に接続中...",
      `${AI_MODELS.find(m=>m.id===aiModel)?.name || "Kling"} にリクエスト送信中...`,
      "AIが映像を生成中... (1〜5分かかります)",
      "動画を処理中...",
      "仕上げ中...",
    ];
    progressMessages.forEach((msg, i) => {
      setTimeout(() => { setGenStep(i); setGenProgress(msg); }, i * 800);
    });

    try {
      // ── プロンプト構築（AI強化エンジン） ──
      const varIdx = VARIATIONS.findIndex(v=>v.id===variation);
      const copyText = copies[varIdx] || copies[0] || "";
      const tmplObj = TEMPLATES.find(t => t.id === template);

      let finalPrompt = "";

      if (aiPromptMode === "auto" || aiPromptMode === "hybrid") {
        // AIによる自動強化
        setGenProgress("✨ Claudeがプロンプトを最適化中...");
        const enhanced = await buildCinematicPrompt({
          productName: product?.productName || "",
          category: product?.category || "",
          catchphrase: product?.catchphrase || "",
          mainCopy: copyText,
          platform,
          cameraMove,
          motionStrength,
          lightingStyle,
          userPrompt: aiPromptMode === "hybrid" ? (prompt || "") : "",
          templateLabel: tmplObj?.label || "product showcase",
          templateId: tmplObj?.id || "product",
          claudeApiKey,
        });
        if (enhanced) {
          finalPrompt = enhanced;
        } else {
          // フォールバック
          finalPrompt = [
            "Product promotion video, soft natural light, cinematic, high quality.",
            copyText.replace(/\n/g, ". "),
            prompt || "",
            "Smooth camera movement, vertical short video style, 4K quality.",
          ].filter(Boolean).join(" ");
        }
      } else {
        // 手動モード
        finalPrompt = [
          "Product promotion video, soft natural light, cinematic, high quality.",
          copyText.replace(/\n/g, ". "),
          prompt || "",
          "Smooth camera movement, vertical short video style, 4K quality.",
        ].filter(Boolean).join(" ");
      }

      setFinalPromptPreview(finalPrompt);
      setGenProgress("🎬 動画生成中... (1〜5分かかります)");

      const videoUrl = await generateVideoViaClaude({
        falApiKey,
        imageUrl: mainImg,
        promptText: finalPrompt,
        negativePrompt,
        modelId: aiModel,
        platform,
        duration: videoDuration,
        motionStrength,
        onProgress: (msg) => setGenProgress(msg),
      });

      setGeneratedVideoUrl(videoUrl);
      setGenProgress("✅ 生成完了！");

      // ── Projectsに自動保存 ──
      const tmplLabel = TEMPLATES.find(t => t.id === template)?.label || "動画";
      const newProject = {
        id: Date.now(),
        title: (product?.productName || tmplLabel) + "_" + new Date().toLocaleDateString("ja-JP").replace(/\//g, ""),
        date: new Date().toLocaleDateString("ja-JP"),
        duration: "5s",
        status: "completed",
        videoUrl,
        platform,
        template,
        gradient: "linear-gradient(135deg, #f06a28 0%, #7C3AED 100%)",
        emoji: "🎬",
        thumbnail: modelImages[0]?.url || images[0]?.url || null,
      };
      try {
        const existing = JSON.parse(localStorage.getItem("sg_projects") || "[]");
        localStorage.setItem("sg_projects", JSON.stringify([newProject, ...existing].slice(0, 50)));
      } catch {}
    } catch (e) {
      setGenError(`生成エラー: ${e.message}`);
    } finally {
      setGenerating(false);
      setIsRealGenerating(false);
    }
  };

  // 書き出しボタン → APIキー確認 → 生成
  const handleExport = () => {
    if (!falApiKey) { setShowApiModal(true); return; }
    handleRealGenerate();
  };
  const setFalApiKeyPersist = (key) => { setFalApiKey(key); try { localStorage.setItem("sg_falApiKey", key); } catch {} };

  // ダウンロード
  const handleDownload = async () => {
    if (!generatedVideoUrl) return;
    const a = document.createElement("a");
    a.href = generatedVideoUrl;
    a.download = `shortgen_${Date.now()}.mp4`;
    a.target = "_blank";
    a.click();
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'Public Sans','Noto Sans JP',sans-serif", background: "#fafafa", color: "#111" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#f5f5f5;}::-webkit-scrollbar-thumb{background:#e0e0e0;border-radius:2px;}
        button,input,textarea{font-family:inherit;}
      `}</style>

      {/* APIキーモーダル */}
      {showApiModal && (
        <ApiKeyModal
          onSave={(key) => { setFalApiKeyPersist(key); setShowApiModal(false); setTimeout(handleRealGenerate, 100); }}
          onClose={() => setShowApiModal(false)}
        />
      )}

      {/* 生成済み動画プレビュー */}
      {generatedVideoUrl && (
        <VideoResult
          url={generatedVideoUrl}
          onClose={() => setGeneratedVideoUrl(null)}
          onDownload={handleDownload}
          titleText={titleText}
          copyText={copies[VARIATIONS.findIndex(v=>v.id===variation)] || copies[0] || ""}
          subtitlePreset={subtitlePreset}
        />
      )}

      <Sidebar step={step} navPage={navPage} setNavPage={setNavPage} onCreateNew={() => { setNavPage("editor"); setStep(1); }} userName={user?.displayName || userName} userPhoto={user?.photoURL} onLogout={onLogout} />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {navPage === "home" && <HomePage onCreateNew={() => { setNavPage("editor"); setStep(1); }} onStartFromTemplate={(id) => { setTemplatePersist(id); setNavPage("editor"); setStep(2); }} falApiKey={falApiKey} onSetApiKey={() => setShowApiModal(true)} notifications={notifications} notifUnread={notifUnread} showNotif={showNotif} onToggleNotif={handleToggleNotif} onClearNotif={handleClearNotif} onGoProjects={() => setNavPage("projects")} />}
        {navPage === "projects" && <ProjectsPage onCreateNew={() => { setNavPage("editor"); setStep(1); }} userName={userName} />}
        {navPage === "assets" && <AssetsPage onUseInProject={(asset) => { if (asset.type === "image" || asset.type === "video") { setImages(prev => [{ url: asset.dataUrl || asset.bg, id: asset.id, name: asset.name }, ...prev].slice(0,6)); } setNavPage("editor"); setStep(2); }} />}
        {navPage === "settings" && <SettingsPage userName={userName} onUserNameChange={handleUserNameChange} claudeApiKey={claudeApiKey} onClaudeApiKeyChange={setClaudeApiKeyPersist} />}
        {navPage === "editor" && step===1 && <Step1 selected={template} onSelect={setTemplatePersist} onNext={()=>setStep(2)} />}
        {navPage === "editor" && step===2 && (
          <Step2
            platform={platform} setPlatform={setPlatformPersist}
            url={url} setUrl={setUrlPersist} images={images} setImages={setImages}
            modelImages={modelImages} setModelImages={setModelImages}
            onNext={()=>{ setStep(3); handleGenerateMock(); }} onBack={()=>setStep(1)}
            product={product} setProduct={setProductPersist} analyzing={analyzing} onAnalyze={handleAnalyze}
            urlErr={urlErr} prompt={prompt} setPrompt={setPromptPersist}
            showPrompt={showPrompt} setShowPrompt={setShowPrompt}
            aiModel={aiModel} setAiModel={setAiModelPersist}
            onGenerateCopy={handleGenerateCopy} copyGenerating={copyGenerating} copies={copies}
          />
        )}
        {navPage === "editor" && step===3 && (
          <Step3
            product={product} images={images} modelImages={modelImages}
            template={template} platform={platform} aiModel={aiModel}
            variation={variation} setVariation={setVariation}
            copies={copies} setCopies={setCopies}
            bgm={bgm} setBgm={setBgm} voice={voice} setVoice={setVoice}
            titleText={titleText} setTitleText={setTitleText}
            selectedFont={selectedFont} setSelectedFont={setSelectedFont}
            subtitlePreset={subtitlePreset} setSubtitlePreset={setSubtitlePreset}
            transitionPreset={transitionPreset} setTransitionPreset={setTransitionPreset}
            overlayPreset={overlayPreset} setOverlayPreset={setOverlayPreset}
            onBack={()=>setStep(2)} onRegenerate={handleGenerateMock}
            generating={generating} genStep={genStep}
            genProgress={genProgress} genError={genError}
            isRealGenerating={isRealGenerating}
            onExport={handleExport}
            falApiKey={falApiKey}
            onSetApiKey={() => setShowApiModal(true)}
            cameraMove={cameraMove} setCameraMove={setCameraMove}
            motionStrength={motionStrength} setMotionStrength={setMotionStrength}
            negativePrompt={negativePrompt} setNegativePrompt={setNegativePrompt}
            videoDuration={videoDuration} setVideoDuration={setVideoDuration}
            lightingStyle={lightingStyle} setLightingStyle={setLightingStyle}
            aiPromptMode={aiPromptMode} setAiPromptMode={setAiPromptMode}
            finalPromptPreview={finalPromptPreview}
            selectedVideoImg={selectedVideoImg} setSelectedVideoImg={setSelectedVideoImg}
          />
        )}
      </main>
    </div>
  );
}

/* ─── AuthWrapper（最終export） ─── */
export default function App() {
  const [user, setUser] = useState(undefined);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    getFirebaseAuth()
      .then(() => {
        if (window.__fbOnAuth) {
          window.__fbOnAuth((u) => setUser(u || null));
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null));
  }, []);

  const handleLogin = async () => {
    setAuthLoading(true);
    try {
      await getFirebaseAuth();
      await window.__fbSignIn();
    } catch (e) {
      console.warn("ログインエラー:", e.code || e.message);
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try { if (window.__fbSignOut) await window.__fbSignOut(); } catch {}
    setUser(null);
  };

  // ローディング中
  if (user === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1A202C" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "#f06a28", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>読み込み中...</div>
        </div>
      </div>
    );
  }

  // 未ログイン → ログイン画面
  // ※Firebase未設定（YOUR_API_KEY のまま）の場合はこの行をコメントアウトすると認証スキップできる
  if (user === null) {
    return <LoginScreen onLogin={handleLogin} loading={authLoading} />;
  }

  return <ErrorBoundary><MainApp user={user} onLogout={handleLogout} /></ErrorBoundary>;
}
