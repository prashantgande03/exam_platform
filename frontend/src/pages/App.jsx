import React from 'react'
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom'
import Login from './Login'
import Exam from './Exam'
import Result from './Result'
import Admin from './Admin'
import { useAuth } from '../store'

function Nav() {
  const { token, role, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <nav className="bg-white shadow mb-4">
      <div className="container flex items-center justify-between py-3">
        <Link to="/" className="font-semibold">AI Exam</Link>
        <div className="flex items-center gap-4">
          {role === 'admin' && <Link to="/admin" className="text-blue-600">Admin</Link>}
          {token ? (
            <button className="btn" onClick={() => { logout(); navigate('/') }}>Logout</button>
          ) : (
            <Link to="/login" className="btn">Login</Link>
          )}
        </div>
      </div>
    </nav>
  )
}

export default function App() {
  const { token } = useAuth()
  return (
    <div>
      <Nav />
      <div className="container">
        <Routes>
          <Route path="/" element={<Navigate to={token ? '/exam' : '/login'} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/exam" element={<Exam />} />
          <Route path="/result" element={<Result />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>
    </div>
  )
}
