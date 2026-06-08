import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getDatabase,
  ref,
  onValue,
  update,
} from "firebase/database";

import "bootstrap/dist/css/bootstrap.min.css";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

const cleanNumericValue = (val) => {
  if (val === undefined || val === null) return 0;
  const str = String(val).trim();
  const match = str.match(/^-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
};

// --- HIGH VISIBILITY CUSTOM GAUGE COMPONENTS ---

// 1. Large Semi-Circular Gauge (For Gyro Magnitude)
const SemiGauge = ({ value, min = 0, max = 100, title, unit }) => {
  const percentage = Math.min(Math.max((value - min) / (max - min), 0), 1);
  const rotation = percentage * 180 - 90; 

  return (
    <div className="card border-0 shadow-sm rounded-3 p-4 bg-white h-100 d-flex flex-column align-items-center justify-content-between">
      <div className="w-100 text-center">
        <p className="text-uppercase tracking-wider text-muted fw-bold mb-3" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>{title}</p>
      </div>
      
      <div style={{ position: 'relative', width: '240px', height: '130px', overflow: 'hidden' }} className="my-2">
        {/* Track */}
        <div style={{
          position: 'absolute', width: '240px', height: '240px', 
          borderRadius: '50%', border: '20px solid #f1f5f9', top: 0, left: 0
        }} />
        {/* Pin Base */}
        <div style={{
          position: 'absolute', width: '14px', height: '14px', borderRadius: '50%',
          backgroundColor: '#334155', bottom: '-2px', left: '113px', zIndex: 3
        }} />
        {/* Needle */}
        <div style={{
          position: 'absolute', width: '4px', height: '105px', backgroundColor: '#ef4444',
          bottom: 0, left: '118px', transformOrigin: 'bottom center',
          transform: `rotate(${rotation}deg)`, transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)', zIndex: 2,
          borderRadius: '2px'
        }} />
      </div>
      <div className="text-center mt-2">
        <span className="display-6 fw-bold text-dark m-0">{value.toFixed(2)}</span>
        <span className="text-secondary fw-semibold fs-5 ms-2">{unit}</span>
      </div>
    </div>
  );
};

// 2. Large Circular Dial Gauge (For BME280 Indexes)
const CircularDial = ({ value, min = 0, max = 100, title, unit, color = "#3b82f6" }) => {
  const radius = 68; 
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(Math.max((value - min) / (max - min), 0), 1);
  const strokeDashoffset = circumference - percentage * circumference;

  return (
    <div className="d-flex flex-column align-items-center justify-content-center p-3">
      <p className="text-uppercase tracking-wider text-muted fw-bold mb-4" style={{ fontSize: '0.8rem', letterSpacing: '0.05em' }}>{title}</p>
      
      <div style={{ position: 'relative', width: '160px', height: '160px' }}>
        <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="80" cy="80" r={radius} fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
          <circle 
            cx="80" cy="80" r={radius} fill="transparent" stroke={color} strokeWidth="12" 
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        </svg>
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '160px', height: '160px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center'
        }}>
          <span className="display-6 fw-bold text-dark m-0 font-monospace" style={{ transform: 'translateY(4px)' }}>{value.toFixed(1)}</span>
          <span className="text-muted fw-medium mt-1" style={{ fontSize: '0.85rem', transform: 'translateY(4px)' }}>{unit}</span>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastGyroUpdate, setLastGyroUpdate] = useState(0); 

  const prevGyroMagRef = useRef(null);
  const isBootWindowPassed = useRef(false);

  const [sensorData, setSensorData] = useState({
    ai_decision: {},
    data: {},
    esp32: {},
  });

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setLoggedIn(!!user);
    });
  }, []);

  useEffect(() => {
    if (!loggedIn) {
      isBootWindowPassed.current = false;
      setIsOnline(false);
      return;
    }

    const bootTimer = setTimeout(() => {
      isBootWindowPassed.current = true;
    }, 30000); 

    return () => clearTimeout(bootTimer);
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn) return;
    const dbRef = ref(database);
    
    return onValue(dbRef, (snapshot) => {
      const firebaseData = snapshot.val();
      
      if (firebaseData) {
        const currentGyroMag = firebaseData?.ai_decision?.gyro_mag;

        if (isBootWindowPassed.current && currentGyroMag !== undefined) {
          if (prevGyroMagRef.current !== currentGyroMag) {
            setLastGyroUpdate(Date.now());
            setIsOnline(true);
            prevGyroMagRef.current = currentGyroMag; 
          }
        }

        setSensorData({
          ai_decision: firebaseData?.ai_decision || {},
          data: firebaseData?.data || {},
          esp32: firebaseData?.esp32 || {},
        });
      }
    });
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn || lastGyroUpdate === 0) return;

    const interval = setInterval(() => {
      const timeSinceLastGyro = Date.now() - lastGyroUpdate;
      if (timeSinceLastGyro > 5000) {
        setIsOnline(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastGyroUpdate, loggedIn]);

  const toggleBuzzer = () => {
    const currentStatus = sensorData.esp32.buzzer_button || "off";
    const nextStatus = currentStatus === "on" ? "off" : "on";
    
    update(ref(database, 'esp32'), {
      buzzer_button: nextStatus
    }).catch((error) => {
      console.error("Failed to update buzzer status:", error);
    });
  };

  if (!loggedIn) {
    return (
      <div className="container-fluid d-flex justify-content-center align-items-center" style={{ height: "100vh", backgroundColor: "#0f172a" }}>
        <div className="card border-0 shadow-lg p-5 bg-white text-dark" style={{ width: "100%", maxWidth: "420px", borderRadius: "12px" }}>
          <div className="text-center mb-4">
            <div className="bg-light text-primary d-inline-block p-3 rounded-circle mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" className="bi bi-cpu" viewBox="0 0 16 16">
                <path d="M5 0a.5.5 0 0 1 .5.5V2h1V.5a.5.5 0 0 1 1 0V2h1V.5a.5.5 0 0 1 1 0V2h1V.5a.5.5 0 0 1 1 0V2h1V.5a.5.5 0 0 1 1 0V2A2.5 2.5 0 0 1 14 4.5h1.5a.5.5 0 0 1 0-1H14v1h1.5a.5.5 0 0 1 0-1H14v1h1.5a.5.5 0 0 1 0-1H14v1h1.5a.5.5 0 0 1 0-1H14A2.5 2.5 0 0 1 11.5 14v1.5a.5.5 0 0 1-1 0V14h-1v1.5a.5.5 0 0 1-1 0V14h-1v1.5a.5.5 0 0 1-1 0V14h-1v1.5a.5.5 0 0 1-1 0V14A2.5 2.5 0 0 1 2 11.5H.5a.5.5 0 0 1 0-1H2v-1H.5a.5.5 0 0 1 0-1H2v-1H.5a.5.5 0 0 1 0-1H2v-1H.5a.5.5 0 0 1 0-1H2A2.5 2.5 0 0 1 4.5 2V.5A.5.5 0 0 1 5 0m-.5 3A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13h7a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 11.5 3z"/>
              </svg>
            </div>
            <h4 className="fw-bold m-0 text-dark">IoT Enterprise Portal</h4>
            <p className="text-muted small mb-0">Sign in to manage edge processing nodes</p>
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            signInWithEmailAndPassword(auth, e.target.email.value, e.target.password.value).catch(() => alert("Login Failed."));
          }}>
            <div className="mb-3">
              <label className="form-label small fw-semibold text-secondary">Email Address</label>
              <input name="email" type="email" className="form-control form-control-lg border shadow-none" style={{ borderRadius: '6px' }} required />
            </div>
            <div className="mb-4">
              <label className="form-label small fw-semibold text-secondary">Password</label>
              <input name="password" type="password" className="form-control form-control-lg border shadow-none" style={{ borderRadius: '6px' }} required />
            </div>
            <button className="btn btn-dark btn-lg w-100 fw-medium shadow-sm" style={{ borderRadius: "6px" }}>Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid p-0" style={{ backgroundColor: "#f8fafc" }}>
      <div className="row g-0" style={{ minHeight: "100vh" }}>
        
        {/* SIDEBAR NAVIGATION */}
        <div className="col-12 col-md-3 col-lg-2 text-white p-4 d-flex flex-column justify-content-between" style={{ backgroundColor: "#0f172a", borderRight: "1px solid #1e293b" }}>
          <div>
            <div className="d-flex align-items-center mb-4 pb-3 border-bottom border-secondary border-opacity-10">
              <div className="bg-primary p-2 rounded-2 me-2 text-white d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="bi bi-activity" viewBox="0 0 16 16">
                  <path fillRule="evenodd" d="M6 2a.5.5 0 0 1 .47.33L10 12.036l1.523-3.046A.5.5 0 0 1 12 8.7h3a.5.5 0 0 1 0h-2.738l-2.03 4.05a.5.5 0 0 1-.9.03L5.12 3.319l-1.494 2.987A.5.5 0 0 1 3.18 6.5H.5a.5.5 0 0 1 0-1h2.417l1.6-3.2A.5.5 0 0 1 5 2z"/>
                </svg>
              </div>
              <span className="fw-bold tracking-tight m-0 fs-5">Smart Vest</span>
              <span className={`ms-auto badge ${isOnline ? 'bg-success' : 'bg-danger'} rounded-circle p-1`} style={{ width: '10px', height: '10px' }} title={isOnline ? "Online" : "Offline"} />
            </div>
            <ul className="nav flex-row flex-md-column gap-2 mb-3 mb-md-0">
              <li className="nav-item w-100">
                <a href="#dashboard" className="nav-link text-white bg-secondary bg-opacity-25 rounded-2 py-2.5 px-3 fw-medium">Overview</a>
              </li>
            </ul>
          </div>
          <button className="btn btn-outline-secondary border-0 text-white-50 text-start w-100 py-2.5 d-flex align-items-center justify-content-start mt-3" onClick={() => signOut(auth)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-box-arrow-left me-2" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M6 12.5a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-8a.5.5 0 0 0-.5.5v2a.5.5 0 0 1-1 0v-2A1.5 1.5 0 0 1 6.5 2h8A1.5 1.5 0 0 1 16 3.5v9a1.5 1.5 0 0 1-1 1.5h-8A1.5 1.5 0 0 1 5 12.5v-2a.5.5 0 0 1 1 0z"/>
              <path fillRule="evenodd" d="M.146 8.354a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L1.707 7.5H10.5a.5.5 0 0 1 0 1H1.707l2.147 2.146a.5.5 0 0 1-.708.708z"/>
            </svg>
            <span className="small">Disconnect Portal</span>
          </button>
        </div>

        {/* MAIN DASHBOARD BLOCK */}
        <div className="col-12 col-md-9 col-lg-10 p-4 p-md-5">
          
          {/* UPDATED HEADER: FLOATS ACTUATOR CONTROL TO THE TOP RIGHT */}
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3 mb-4 pb-2">
            <div>
              <h2 className="fw-bold text-dark m-0">IoT Monitoring</h2>
              <p className="text-muted m-0">Real-time telemetry stream from edge units</p>
            </div>
            
            {/* COMPACTED TOP-RIGHT ACTUATOR TOGGLE PANEL */}
            <div className="card border-0 shadow-sm rounded-3 py-2.5 px-4 bg-white d-flex flex-row align-items-center gap-3 border" style={{ minWidth: '240px' }}>
              <div className="me-2">
                <h6 className="fw-bold text-dark m-0" style={{ fontSize: '0.9rem' }}>Buzzer Control</h6>
                <span className="small fw-bold tracking-wider" style={{ fontSize: '0.75rem', color: sensorData.esp32.buzzer_button === "on" ? '#10b981' : '#64748b' }}>
                  {sensorData.esp32.buzzer_button === "on" ? "ACTIVE" : "MUTED"}
                </span>
              </div>
              <div className="ms-auto" style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
                <input
                  type="checkbox"
                  id="buzzerToggle"
                  checked={sensorData.esp32.buzzer_button === "on"}
                  onChange={toggleBuzzer}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <label 
                  htmlFor="buzzerToggle"
                  style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: sensorData.esp32.buzzer_button === "on" ? '#10b981' : '#cbd5e1',
                    transition: '.2s', borderRadius: '24px'
                  }}
                >
                  <span style={{
                    position: 'absolute', height: '18px', width: '18px', left: '3px', bottom: '3px',
                    backgroundColor: 'white', transition: '.2s', borderRadius: '50%',
                    transform: sensorData.esp32.buzzer_button === "on" ? 'translateX(22px)' : 'translateX(0)'
                  }} />
                </label>
              </div>
            </div>
          </div>

          {/* MAIN TOP ROW GRID */}
          <div className="row g-4 mb-4">
            
            {/* MATCHED SCREENSHOT MOCKUP FOR AI STATE */}
            <div className="col-12 col-sm-6">
              <div className="card h-100 border-0 shadow-sm rounded-3 p-4 bg-white d-flex flex-column align-items-center justify-content-center">
                <p className="text-uppercase tracking-wider text-muted fw-bold mb-3 w-100 text-center" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                  AI Status State
                </p>
                <div className="w-100 d-flex justify-content-center align-items-center my-auto px-2">
                  <div 
                    className="w-100 text-center fw-bold" 
                    style={{
                      backgroundColor: sensorData.ai_decision.state === "Resting" ? "#eef6f3" : "#fff9db",
                      color: sensorData.ai_decision.state === "Resting" ? "#137347" : "#f59f00",
                      border: `1px solid ${sensorData.ai_decision.state === "Resting" ? "#d1e7dd" : "#ffe3e3"}`,
                      borderRadius: "16px",
                      padding: "1.25rem 2rem",
                      fontSize: "1.75rem",
                      maxWidth: "460px"
                    }}
                  >
                    {sensorData.ai_decision.state || "Unknown"}
                  </div>
                </div>
              </div>
            </div>

            {/* GYRO MAGNITUDE SEMI GAUGE */}
            <div className="col-12 col-sm-6">
              <SemiGauge 
                value={cleanNumericValue(sensorData.ai_decision.gyro_mag)} 
                min={0} 
                max={100} 
                title="Gyro Magnitude Gauge" 
                unit="rad/s" 
              />
            </div>
          </div>

          {/* LOWER LAYOUT GRID */}
          <div className="row g-4">
            
            {/* BME280 ENVIRO INSTRUMENTS BLOCK */}
            <div className="col-12">
              <div className="card border-0 shadow-sm rounded-3 bg-white">
                <div className="card-header bg-white border-bottom border-light py-3.5 px-4">
                  <h5 className="m-0 fw-bold text-dark" style={{ fontSize: '1rem' }}>BME280 Environmental Instrument Gauges</h5>
                </div>
                <div className="p-4">
                  <div className="row g-4 text-center justify-content-around">
                    <div className="col-12 col-sm-4">
                      <CircularDial 
                        value={cleanNumericValue(sensorData.data.temperature)} 
                        min={0} max={50} title="Thermal Index" unit="°C" color="#f97316" 
                      />
                    </div>
                    <div className="col-12 col-sm-4">
                      <CircularDial 
                        value={cleanNumericValue(sensorData.data.humidity)} 
                        min={0} max={100} title="Humidity Matrix" unit="% RH" color="#06b6d4" 
                      />
                    </div>
                    <div className="col-12 col-sm-4">
                      <CircularDial 
                        value={cleanNumericValue(sensorData.data.pressure)} 
                        min={900} max={1100} title="Atmospheric Pressure" unit="hPa" color="#10b981" 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ACCELEROMETER MATRIX */}
            <div className="col-lg-6">
              <div className="card border-0 shadow-sm rounded-3 bg-white h-100">
                <div className="card-header bg-white border-bottom border-light py-3.5 px-4">
                  <h5 className="m-0 fw-bold text-dark" style={{ fontSize: '1rem' }}>Accelerometer Matrix</h5>
                </div>
                <div className="p-4">
                  <div className="d-flex justify-content-between py-3 border-bottom border-light fs-5">
                    <span className="text-secondary">X-Axis Value</span>
                    <span className="fw-bold font-monospace text-dark">{sensorData.data.accel_x ?? "--"}</span>
                  </div>
                  <div className="d-flex justify-content-between py-3 border-bottom border-light fs-5">
                    <span className="text-secondary">Y-Axis Value</span>
                    <span className="fw-bold font-monospace text-dark">{sensorData.data.accel_y ?? "--"}</span>
                  </div>
                  <div className="d-flex justify-content-between py-3 pb-1 fs-5">
                    <span className="text-secondary">Z-Axis Value</span>
                    <span className="fw-bold font-monospace text-dark">{sensorData.data.accel_z ?? "--"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* GYROSCOPE MATRIX */}
            <div className="col-lg-6">
              <div className="card border-0 shadow-sm rounded-3 bg-white h-100">
                <div className="card-header bg-white border-bottom border-light py-3.5 px-4">
                  <h5 className="m-0 fw-bold text-dark" style={{ fontSize: '1rem' }}>Gyroscope Matrix</h5>
                </div>
                <div className="p-4">
                  <div className="d-flex justify-content-between py-3 border-bottom border-light fs-5">
                    <span className="text-secondary">X-Axis Rotational</span>
                    <span className="fw-bold font-monospace text-dark">{sensorData.data.gyro_x ?? "--"}</span>
                  </div>
                  <div className="d-flex justify-content-between py-3 border-bottom border-light fs-5">
                    <span className="text-secondary">Y-Axis Rotational</span>
                    <span className="fw-bold font-monospace text-dark">{sensorData.data.gyro_y ?? "--"}</span>
                  </div>
                  <div className="d-flex justify-content-between py-3 pb-1 fs-5">
                    <span className="text-secondary">Z-Axis Rotational</span>
                    <span className="fw-bold font-monospace text-dark">{sensorData.data.gyro_z ?? "--"}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default App;