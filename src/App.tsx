import { Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import PlayShell from './components/PlayShell';
import './App.css';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/play" element={<PlayShell />} />
    </Routes>
  );
}
