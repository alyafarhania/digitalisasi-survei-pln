import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../lib/authContext'
import { MOCK_USERS, ROLES, ROLE_KEYS } from '../lib/auth'
import { Alert, Button, Chip, Field, Icon, Input } from '../components/ui'

// Halaman masuk (MOCK). Akun demo ditampilkan agar mudah mencoba tiap peran (RBAC).
export const nextDariUrl = () => {
  const n = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('next')
  return n && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/login') ? n : '/'
}
export default function Login() {
  const { login } = useAuth(), router = useRouter()
  const [role, setRole] = useState('surveyor'), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [show, setShow] = useState(false), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    const r = await login(email, password, role); setBusy(false)
    if (r.ok) router.replace(nextDariUrl()); else setErr(r.error)
  }
  return (
    <div className="login">
      <div className="login-card">
        <img className="login-logo" src="/logo-pln.png" alt="PLN" />
        <h1>Masuk</h1>
        <p className="login-sub">Survei Tambah Daya &amp; Pasang Baru<br />PT PLN (Persero) · UP3 Klaten</p>
        <div className="rolepick" role="radiogroup" aria-label="Masuk sebagai">
          {ROLE_KEYS.map((k) => (
            <button type="button" key={k} role="radio" aria-checked={role === k} className={role === k ? 'on' : ''} onClick={() => { setRole(k); setErr(''); setEmail(''); setPassword('') }}>
              <b>{ROLES[k].label}</b>
              <small>{k === 'surveyor' ? 'Bertugas melakukan survei' : 'Bertugas finalisasi hasil survei'}</small>
            </button>
          ))}
        </div>
        <form onSubmit={submit} noValidate>
          <Field label="Email"><Input type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@pln.test" /></Field>
          <Field label="Kata sandi">
            <div className="pwd">
              <Input type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Kata sandi" />
              <button type="button" className="pwd-t" onClick={() => setShow(!show)} aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>{show ? 'Sembunyikan' : 'Tampilkan'}</button>
            </div>
          </Field>
          {err && <Alert tone="bad">{err}</Alert>}
          <Button type="submit" className="login-btn" disabled={busy || !email || !password}>{busy ? 'Memeriksa…' : 'Masuk'}</Button>
        </form>
        <div className="demo">
          <div className="demo-h"><Icon n="check" size={14} /> Akun demo {ROLES[role].label} (mock) — ketuk untuk mengisi</div>
          {MOCK_USERS.filter((u) => u.role === role).map((u) => (
            <button type="button" key={u.id} className="demo-i" onClick={() => { setEmail(u.email); setPassword(u.password); setErr('') }}>
              <span className="demo-av">{u.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span>
              <span className="demo-t"><b>{u.name}</b><small>{u.email}</small></span>
              <Chip tone={u.role === 'asman' ? 'info' : 'ok'}>{ROLES[u.role].label}</Chip>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
