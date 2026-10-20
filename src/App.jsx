import React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen, Cloud, FileText, LayoutDashboard, LogOut, Plus, UploadCloud,
  Users, Clock3, CheckCircle2, Download, Search, ShieldCheck, RefreshCw,
  GraduationCap, X, AlertCircle
} from "lucide-react";
import { isConfigured, supabase } from "./lib/supabase";

const BUCKET = "cloudclass-files";
const prettyDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "No deadline";
const initials = (name = "CloudClass") => name.trim().split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase()).join("");

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authMode, setAuthMode] = useState("signin");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", deadline: "" });
  const [assignmentFile, setAssignmentFile] = useState(null);
  const [uploadingFor, setUploadingFor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState({ type: "", text: "" });

  const isTeacher = profile?.role === "teacher" || profile?.role === "admin";

  useEffect(() => {
    if (!isConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null); setAssignments([]); setSubmissions([]);
      return;
    }
    loadData();
  }, [session?.user?.id]);

  async function loadData() {
    setLoading(true);
    setNotice({ type: "", text: "" });
    const userId = session.user.id;
    const [profileResult, assignmentResult, submissionResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("assignments").select("*").order("created_at", { ascending: false }),
      supabase.from("submissions").select("*").order("submitted_at", { ascending: false })
    ]);
    if (profileResult.error) setNotice({ type: "error", text: profileResult.error.message });
    else setProfile(profileResult.data);
    if (assignmentResult.error) setNotice({ type: "error", text: assignmentResult.error.message });
    else setAssignments(assignmentResult.data || []);
    if (submissionResult.error) setNotice({ type: "error", text: submissionResult.error.message });
    else setSubmissions(submissionResult.data || []);
    setLoading(false);
  }

  async function handleAuth(event) {
    event.preventDefault();
    setLoading(true); setNotice({ type: "", text: "" });
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: authForm.email.trim(),
          password: authForm.password,
          options: { data: { full_name: authForm.name.trim() } }
        });
        if (error) throw error;
        if (!data.session) {
          setNotice({ type: "success", text: "Account created. Check your email to confirm, then sign in." });
        } else {
          setNotice({ type: "success", text: "Account created successfully." });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authForm.email.trim(), password: authForm.password
        });
        if (error) throw error;
      }
    } catch (error) {
      setNotice({ type: "error", text: error.message || "Authentication failed." });
    } finally { setLoading(false); }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSession(null);
  }

  async function createAssignment(event) {
    event.preventDefault();
    if (!isTeacher) {
      setNotice({ type: "error", text: "Your account is not a teacher account. Ask the project admin to assign the teacher role." });
      return;
    }
    setLoading(true); setNotice({ type: "", text: "" });
    try {
      let filePath = null;
      if (assignmentFile) {
        const safeName = assignmentFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        filePath = `${session.user.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, assignmentFile);
        if (uploadError) throw uploadError;
      }
      const { error } = await supabase.from("assignments").insert({
        title: form.title.trim(),
        description: form.description.trim(),
        deadline: form.deadline || null,
        file_path: filePath,
        created_by: session.user.id
      });
      if (error) throw error;
      setForm({ title: "", description: "", deadline: "" });
      setAssignmentFile(null); setShowCreate(false);
      setNotice({ type: "success", text: "Assignment published to the cloud." });
      await loadData();
    } catch (error) {
      setNotice({ type: "error", text: error.message || "Could not create assignment." });
    } finally { setLoading(false); }
  }

  async function submitWork(assignmentId, file) {
    if (!file) return;
    setUploadingFor(assignmentId); setNotice({ type: "", text: "" });
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${session.user.id}/${assignmentId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("submissions").upsert({
        assignment_id: assignmentId,
        student_id: session.user.id,
        file_path: path,
        status: "submitted",
        submitted_at: new Date().toISOString()
      }, { onConflict: "assignment_id,student_id" });
      if (error) throw error;
      setNotice({ type: "success", text: "Your submission was uploaded successfully." });
      await loadData();
    } catch (error) {
      setNotice({ type: "error", text: error.message || "Submission failed." });
    } finally { setUploadingFor(null); }
  }

  async function downloadFile(path, originalName = "cloudclass-file") {
    if (!path) return;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error) { setNotice({ type: "error", text: error.message }); return; }
    const anchor = document.createElement("a");
    anchor.href = data.signedUrl; anchor.download = originalName; anchor.target = "_blank";
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
  }

  async function updateSubmissionStatus(id, status) {
    const { error } = await supabase.from("submissions").update({ status }).eq("id", id);
    if (error) setNotice({ type: "error", text: error.message });
    else { setNotice({ type: "success", text: `Submission marked ${status}.` }); await loadData(); }
  }

  const visibleAssignments = useMemo(() => assignments.filter(a =>
    `${a.title} ${a.description || ""}`.toLowerCase().includes(search.toLowerCase())
  ), [assignments, search]);

  const mySubmissions = submissions.filter(s => s.student_id === session?.user?.id);
  const pendingCount = isTeacher
    ? submissions.filter(s => s.status === "submitted").length
    : assignments.filter(a => !mySubmissions.some(s => s.assignment_id === a.id)).length;

  if (!isConfigured) return <SetupScreen />;

  if (!session) return (
    <main className="auth-page">
      <div className="auth-visual">
        <div className="brand brand-light"><span className="brand-icon"><Cloud size={22}/></span><span>CloudClass</span></div>
        <div className="auth-hero">
          <div className="eyebrow"><span className="pulse"></span> CLOUD-POWERED LEARNING</div>
          <h1>Learning resources.<br/><em>One cloud.</em></h1>
          <p>A simple, secure space to share assignments, submit work and keep your class connected.</p>
          <div className="hero-points">
            <span><ShieldCheck size={17}/> Secure access</span>
            <span><UploadCloud size={17}/> Cloud file storage</span>
            <span><Users size={17}/> Student & teacher roles</span>
          </div>
        </div>
        <div className="visual-footer">MCA Semester III · DSCC Mini Project</div>
      </div>
      <div className="auth-form-side">
        <form className="auth-card" onSubmit={handleAuth}>
          <div className="mobile-brand brand"><span className="brand-icon"><Cloud size={22}/></span><span>CloudClass</span></div>
          <div className="auth-heading">
            <span className="eyebrow">{authMode === "signin" ? "WELCOME BACK" : "GET STARTED"}</span>
            <h2>{authMode === "signin" ? "Sign in to your class" : "Create your account"}</h2>
            <p>{authMode === "signin" ? "Enter your details to access your workspace." : "Create a student account to get started."}</p>
          </div>
          {authMode === "signup" && <label>Full name<input required value={authForm.name} onChange={e => setAuthForm({...authForm, name:e.target.value})} placeholder="Your full name"/></label>}
          <label>Email address<input required type="email" value={authForm.email} onChange={e => setAuthForm({...authForm, email:e.target.value})} placeholder="you@college.edu"/></label>
          <label>Password<input required minLength={6} type="password" value={authForm.password} onChange={e => setAuthForm({...authForm, password:e.target.value})} placeholder="At least 6 characters"/></label>
          {notice.text && <Notice notice={notice}/>}
          <button className="btn btn-primary btn-full" disabled={loading}>{loading ? "Please wait..." : authMode === "signin" ? "Sign in" : "Create account"}</button>
          <p className="switch-auth">{authMode === "signin" ? "New to CloudClass?" : "Already have an account?"} <button type="button" className="text-button" onClick={() => {setAuthMode(authMode === "signin" ? "signup" : "signin"); setNotice({type:"",text:""});}}>{authMode === "signin" ? "Create account" : "Sign in"}</button></p>
          <p className="auth-note">For this academic demo, new accounts are students by default. A project administrator must promote teacher accounts.</p>
        </form>
      </div>
    </main>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={e => {e.preventDefault();setActiveTab("overview");}}><span className="brand-icon"><Cloud size={22}/></span><span>CloudClass</span></a>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          <button className={`nav-item ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}><LayoutDashboard size={18}/> Overview</button>
          <button className={`nav-item ${activeTab === "assignments" ? "active" : ""}`} onClick={() => setActiveTab("assignments")}><BookOpen size={18}/> Assignments <span className="nav-count">{assignments.length}</span></button>
          <button className={`nav-item ${activeTab === "submissions" ? "active" : ""}`} onClick={() => setActiveTab("submissions")}><FileText size={18}/> {isTeacher ? "Student work" : "My submissions"}</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="cloud-status"><span className="status-dot"></span><div><strong>Cloud connected</strong><small>Supabase services</small></div></div>
          <div className="profile-mini"><div className="avatar">{initials(profile?.full_name || session.user.email)}</div><div className="profile-info"><strong>{profile?.full_name || session.user.email.split("@")[0]}</strong><small>{profile?.role || "student"} account</small></div><button className="icon-btn" title="Sign out" onClick={handleSignOut}><LogOut size={17}/></button></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div><div className="breadcrumb">Workspace <span>/</span> <b>{activeTab === "overview" ? "Overview" : activeTab === "assignments" ? "Assignments" : isTeacher ? "Student work" : "My submissions"}</b></div><h1>{activeTab === "overview" ? "Your learning space" : activeTab === "assignments" ? "Assignments" : isTeacher ? "Student submissions" : "My submissions"}</h1></div>
          <div className="top-actions"><span className="cloud-chip"><span className="status-dot"></span> Cloud services online</span><div className="avatar avatar-top">{initials(profile?.full_name || session.user.email)}</div></div>
        </header>

        <div className="content">
          {notice.text && <Notice notice={notice} onClose={() => setNotice({type:"",text:""})}/>}
          {activeTab === "overview" && <>
            <section className="welcome-banner">
              <div><span className="eyebrow">YOUR CLASSROOM, CONNECTED</span><h2>Hello, {(profile?.full_name || "there").split(" ")[0]} <span>👋</span></h2><p>Everything your class needs, organized in one cloud workspace.</p></div>
              <div className="banner-art"><div className="art-cloud"><Cloud size={55}/></div><div className="art-file"><FileText size={26}/></div><div className="art-check"><CheckCircle2 size={22}/></div></div>
            </section>
            <section className="stats-grid">
              <Stat icon={<BookOpen/>} label="Total assignments" value={assignments.length} tone="blue" detail="Available in your class"/>
              <Stat icon={<FileText/>} label={isTeacher ? "Total submissions" : "My submissions"} value={isTeacher ? submissions.length : mySubmissions.length} tone="purple" detail={isTeacher ? "Uploaded by students" : "Work uploaded by you"}/>
              <Stat icon={<Clock3/>} label={isTeacher ? "Awaiting review" : "Not submitted"} value={pendingCount} tone="orange" detail={isTeacher ? "Need your attention" : "Assignments to complete"}/>
              <Stat icon={<Cloud/>} label="Cloud storage" value="Active" tone="green" detail="Managed file storage"/>
            </section>
            <div className="section-heading"><div><h3>Recent assignments</h3><p>Latest resources shared with your class</p></div><button className="btn btn-ghost" onClick={() => setActiveTab("assignments")}>View all <span>→</span></button></div>
            <AssignmentList assignments={visibleAssignments.slice(0, 3)} submissions={mySubmissions} isTeacher={isTeacher} onDownload={downloadFile} onSubmit={submitWork} uploadingFor={uploadingFor} emptyMessage="No assignments yet. Your teacher's resources will appear here."/>
          </>}

          {activeTab === "assignments" && <>
            <div className="list-toolbar"><div className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assignments..."/></div>{isTeacher && <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={17}/> New assignment</button>}</div>
            <AssignmentList assignments={visibleAssignments} submissions={mySubmissions} isTeacher={isTeacher} onDownload={downloadFile} onSubmit={submitWork} uploadingFor={uploadingFor} emptyMessage="No assignments found. Try a different search or create your first assignment."/>
          </>}

          {activeTab === "submissions" && (isTeacher ? <TeacherSubmissions submissions={submissions} assignments={assignments} onDownload={downloadFile} onStatus={updateSubmissionStatus}/> : <StudentSubmissions submissions={mySubmissions} assignments={assignments} onDownload={downloadFile}/>)}
          <footer className="footer"><span>CloudClass <b>·</b> MCA DSCC Mini Project</span><span><Cloud size={14}/> Powered by cloud services</span></footer>
        </div>
      </main>

      {showCreate && <div className="modal-backdrop" onMouseDown={e => {if(e.target === e.currentTarget) setShowCreate(false);}}><form className="modal" onSubmit={createAssignment}>
        <div className="modal-header"><div><span className="eyebrow">CLASSROOM RESOURCES</span><h2>Create assignment</h2></div><button type="button" className="icon-btn" onClick={() => setShowCreate(false)}><X size={20}/></button></div>
        <label>Assignment title<input required maxLength={120} value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="e.g. Cloud computing fundamentals"/></label>
        <label>Description<textarea rows="4" maxLength={2000} value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder="Instructions for students..."/></label>
        <label>Submission deadline<input type="date" value={form.deadline} onChange={e => setForm({...form,deadline:e.target.value})}/></label>
        <label className="upload-zone"><UploadCloud size={24}/><strong>{assignmentFile ? assignmentFile.name : "Attach study material (optional)"}</strong><span>Choose a file up to 10 MB</span><input type="file" onChange={e => setAssignmentFile(e.target.files?.[0] || null)} accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg" /></label>
        {assignmentFile && assignmentFile.size > 10 * 1024 * 1024 && <p className="field-error">File exceeds the 10 MB limit.</p>}
        <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button><button className="btn btn-primary" disabled={loading || (assignmentFile && assignmentFile.size > 10 * 1024 * 1024)}>{loading ? "Publishing..." : "Publish assignment"}</button></div>
      </form></div>}
    </div>
  );
}

function SetupScreen() {
  return <main className="setup-page"><div className="setup-card"><div className="brand"><span className="brand-icon"><Cloud size={22}/></span>CloudClass</div><div className="setup-icon"><Cloud size={32}/></div><h1>Connect your cloud workspace</h1><p>Complete the setup steps in the README, then add your Supabase project URL and publishable/anon key to a <code>.env</code> file.</p><ol><li>Create a Supabase project.</li><li>Run <code>supabase/schema.sql</code> in the SQL Editor.</li><li>Copy <code>.env.example</code> to <code>.env</code> and fill in your credentials.</li><li>Run <code>npm install</code> and <code>npm run dev</code>.</li></ol><div className="setup-warning"><AlertCircle size={18}/> Never put a Supabase service-role secret in frontend environment variables.</div></div></main>;
}

function Notice({ notice, onClose }) {
  if (!notice?.text) return null;
  return <div className={`notice ${notice.type === "error" ? "notice-error" : "notice-success"}`}><span>{notice.type === "error" ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>}</span><p>{notice.text}</p>{onClose && <button className="icon-btn" onClick={onClose}><X size={16}/></button>}</div>;
}
function Stat({ icon, label, value, tone, detail }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></div>;
}
function AssignmentList({ assignments, submissions, isTeacher, onDownload, onSubmit, uploadingFor, emptyMessage }) {
  if (!assignments.length) return <div className="empty-state"><div className="empty-icon"><BookOpen size={25}/></div><h3>Nothing here yet</h3><p>{emptyMessage}</p></div>;
  return <div className="assignment-list">{assignments.map(a => {
    const submission = submissions.find(s => s.assignment_id === a.id);
    return <article className="assignment-card" key={a.id}><div className="assignment-file-icon"><FileText size={22}/></div><div className="assignment-info"><div className="assignment-title-row"><h3>{a.title}</h3><span className={`status-pill ${submission ? submission.status : "pending"}`}>{submission ? submission.status : isTeacher ? "published" : "not submitted"}</span></div><p>{a.description || "No additional instructions provided."}</p><div className="assignment-meta"><span><Clock3 size={14}/> Due {prettyDate(a.deadline)}</span><span><Cloud size={14}/> Cloud resource</span></div></div><div className="assignment-actions">{a.file_path && <button className="btn btn-ghost btn-small" onClick={() => onDownload(a.file_path)}><Download size={15}/> Material</button>}{!isTeacher && <label className="btn btn-primary btn-small file-button">{uploadingFor === a.id ? "Uploading..." : submission ? "Replace work" : "Submit work"}<input type="file" disabled={uploadingFor === a.id} onChange={e => {const file=e.target.files?.[0];if(file) { if(file.size > 10*1024*1024) alert("Please select a file smaller than 10 MB."); else onSubmit(a.id,file); } e.target.value="";}} accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"/></label>}</div></article>;
  })}</div>;
}
function StudentSubmissions({ submissions, assignments, onDownload }) {
  if (!submissions.length) return <div className="empty-state"><div className="empty-icon"><FileText size={25}/></div><h3>No submissions yet</h3><p>Your submitted work and review status will appear here.</p></div>;
  return <div className="table-wrap"><table><thead><tr><th>Assignment</th><th>Submitted</th><th>Status</th><th>File</th></tr></thead><tbody>{submissions.map(s => <tr key={s.id}><td><strong>{assignments.find(a=>a.id===s.assignment_id)?.title || "Assignment"}</strong></td><td>{prettyDate(s.submitted_at)}</td><td><span className={`status-pill ${s.status}`}>{s.status}</span></td><td><button className="btn btn-ghost btn-small" onClick={() => onDownload(s.file_path)}><Download size={14}/> Download</button></td></tr>)}</tbody></table></div>;
}
function TeacherSubmissions({ submissions, assignments, onDownload, onStatus }) {
  if (!submissions.length) return <div className="empty-state"><div className="empty-icon"><Users size={25}/></div><h3>No student work yet</h3><p>Submissions will appear here when students upload their files.</p></div>;
  return <div className="table-wrap"><table><thead><tr><th>Assignment</th><th>Student ID</th><th>Submitted</th><th>Status</th><th>Actions</th></tr></thead><tbody>{submissions.map(s => <tr key={s.id}><td><strong>{assignments.find(a=>a.id===s.assignment_id)?.title || "Assignment"}</strong></td><td><code>{s.student_id.slice(0,8)}…</code></td><td>{prettyDate(s.submitted_at)}</td><td><span className={`status-pill ${s.status}`}>{s.status}</span></td><td><div className="table-actions"><button className="btn btn-ghost btn-small" onClick={() => onDownload(s.file_path)}><Download size={14}/></button>{s.status !== "reviewed" && <button className="btn btn-primary btn-small" onClick={() => onStatus(s.id,"reviewed")}><CheckCircle2 size={14}/> Mark reviewed</button>}</div></td></tr>)}</tbody></table></div>;
}

export default App;