import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, signup } from '../services/api'
import { useAuth } from '../store'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSignup, setIsSignup] = useState(false)
  const [role, setRole] = useState('student')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { setAuth } = useAuth()

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = isSignup ? await signup(username, password, role) : await login(username, password)
      const token = data.access_token
      const [, payload] = token.split('.')
      const decoded = JSON.parse(atob(payload))
      setAuth(token, decoded.role, decoded.sub)
      navigate(decoded.role === 'admin' ? '/admin' : '/exam')
    } catch (err) {
      setError(err?.response?.data?.detail || 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="card">
        <h1 className="text-xl font-semibold mb-4">{isSignup ? 'Sign up' : 'Login'}</h1>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <form onSubmit={onSubmit} className="space-y-3">
          <input className="input" placeholder="Username" value={username} onChange={(e)=>setUsername(e.target.value)} required />
          <input className="input" placeholder="Password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required />
          {isSignup && (
            <select className="input" value={role} onChange={(e)=>setRole(e.target.value)}>
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </select>
          )}
          <button className="btn w-full" disabled={loading}>{loading ? 'Please wait...' : (isSignup ? 'Create account' : 'Login')}</button>
        </form>
        <button className="mt-3 text-blue-600" onClick={()=>setIsSignup(!isSignup)}>
          {isSignup ? 'Have an account? Login' : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  )
}
