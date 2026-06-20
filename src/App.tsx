import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import { crc16CcittFalse } from './utils';

export default function App() {
  // 1. Get query parameters from URL state
  const getQueryParams = () => {
    if (typeof window === 'undefined') {
      return { status: '', payload: '', w: '', h: '' };
    }
    const params = new URLSearchParams(window.location.search);
    return {
      status: params.get('status') || '',
      payload: params.get('payload') || '',
      w: params.get('w') || '',
      h: params.get('h') || ''
    };
  };

  const [{ status, payload, w, h }, setParams] = useState(getQueryParams());

  // Listen to popstate or direct URL parameters alteration
  useEffect(() => {
    const handleUrlChange = () => {
      setParams(getQueryParams());
    };
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  // Dynamically configure body styling when active status is 'd' to prevent any surrounding layout/spacing
  useEffect(() => {
    if (status === 'd') {
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.backgroundColor = 'transparent';
      document.body.style.overflow = 'hidden';
      document.body.style.display = 'flex';
      document.body.style.alignItems = 'center';
      document.body.style.justifyContent = 'center';
      document.body.style.height = '100vh';
      document.body.style.width = '100vw';
    } else {
      document.body.style.margin = '';
      document.body.style.padding = '';
      document.body.style.backgroundColor = '';
      document.body.style.overflow = '';
      document.body.style.display = '';
      document.body.style.alignItems = '';
      document.body.style.justifyContent = '';
      document.body.style.height = '';
      document.body.style.width = '';
    }
  }, [status]);

  // Parse CSS dimensions for flexible scaling (defaults to 100% to fill container nicely)
  const parseDimensionStyle = (val: string, defaultVal: string): string => {
    if (!val) return defaultVal;
    const trimmed = val.trim();
    if (/^\d+$/.test(trimmed)) {
      return `${trimmed}px`;
    }
    return trimmed;
  };

  const widthStyle = useMemo(() => parseDimensionStyle(w, '100%'), [w]);
  const heightStyle = useMemo(() => parseDimensionStyle(h, '100%'), [h]);

  // Compute standard payload with custom EMVCo CRC-16 Checksum
  const finalPayload = useMemo(() => {
    if (!payload) return '';
    const checksum = crc16CcittFalse(payload);
    return payload + checksum;
  }, [payload]);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [errorState, setErrorState] = useState<string | null>(null);

  // Generate the actual dynamic QR Code with high resolution for crisp display
  useEffect(() => {
    if (status === 'd' && finalPayload) {
      setErrorState(null);
      // Generate highly detailed image (width 1024px) for perfect crisp scans even when stretched
      QRCode.toDataURL(finalPayload, {
        width: 1024,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000', // pure black
          light: '#ffffff' // pure white
        }
      })
        .then(url => {
          setQrCodeDataUrl(url);
        })
        .catch(err => {
          console.error(err);
          setErrorState('Failed to generate QR Code');
        });
    } else {
      setQrCodeDataUrl('');
    }
  }, [status, finalPayload]);

  // SPECIAL API OUTPUT MODE:
  // If status is "d" (generate), return ONLY the raw image element fitting specified dimensions
  if (status === 'd') {
    if (errorState) {
      return (
        <div style={{ color: '#ef4444', fontFamily: 'sans-serif', fontSize: '12px', padding: '10px' }}>
          {errorState}
        </div>
      );
    }
    if (!qrCodeDataUrl) {
      return (
        <div style={{ color: '#64748b', fontFamily: 'sans-serif', fontSize: '12px', padding: '10px' }}>
          Loading...
        </div>
      );
    }
    return (
      <img
        src={qrCodeDataUrl}
        alt="QR Code"
        style={{
          width: widthStyle,
          height: heightStyle,
          maxWidth: '100vw',
          maxHeight: '100vh',
          objectFit: 'contain',
          margin: 0,
          padding: 0,
          display: 'block',
          backgroundColor: 'transparent'
        }}
        referrerPolicy="no-referrer"
      />
    );
  }

  // Fallback diagnostic helper view if they are not in generation mode
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#f8fafc',
      color: '#0f172a',
      padding: '24px',
      margin: 0,
      textAlign: 'center'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
      }}>
        {status === 'r' ? (
          <div>
            <div style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#fee2e2',
              color: '#ef4444',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: '24px',
              fontWeight: 'bold'
            }}>
              ↺
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 8px' }}>รีเซ็ตระบบแล้ว (Reset Success)</h2>
            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
              ระบบ Web API พร้อมรับการส่งข้อมูลชุดใหม่ทันที
            </p>
          </div>
        ) : (
          <div>
            <div style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#dbeafe',
              color: '#2563eb',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: '24px',
              fontWeight: 'bold'
            }}>
              ⚙
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 8px' }}>PromptPay & EMVCo QR Web API</h2>
            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5', margin: '0 0 20px' }}>
              พร้อมใช้งานสำหรับการแสดงผลบน PowerApps Image control โดยตรง โดยจะแสดงรูปภาพ QR Code แบบเต็มหน้าจอ
            </p>
            <div style={{ textAlign: 'left', backgroundColor: '#f1f5f9', padding: '12px 16px', borderRadius: '8px', wordBreak: 'break-all' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '4px' }}>ตัวอย่างการเรียกใช้งาน:</span>
              <code style={{ fontSize: '11px', color: '#0f172a', fontFamily: 'monospace' }}>
                {window?.location?.origin || 'https://your-domain.com'}/?status=d&amp;payload=00020101021129370014...&amp;w=300px&amp;h=300px
              </code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
