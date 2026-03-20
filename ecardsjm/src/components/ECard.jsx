import React, { useState } from 'react';
import { 
  UserOutlined, 
  PhoneOutlined, 
  MailOutlined, 
  GlobalOutlined, 
  EnvironmentOutlined,
  ShareAltOutlined,
  PlusCircleOutlined,
  QrcodeOutlined,
  WhatsAppOutlined,
  FacebookOutlined,
  LinkedinOutlined,
  InstagramOutlined,
} from '@ant-design/icons';
import './ECard.css';

const ECard = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Contact data based on the image
  const contactData = {
    name: "OSCAR MENDEZ",
    title: "TECNOLU",
    company: "EMPRESA DIGITAL",
    tagline: "somos lo mejor de lo mejor",
    email: "fabio@gmail.com",
    phone: "3205037227",
    website: "vaparup.com.co",
    address: "Calle 55 #45 03 Medellín",
    socialMedia: [
      { icon: <WhatsAppOutlined />, color: '#25D366', label: 'WhatsApp' },
      { icon: <InstagramOutlined />, color: '#833AB4', label: 'Instagram' },
      { icon: <FacebookOutlined />, color: '#1877F2', label: 'Facebook' }
    ],
    sharingIcons: [
      { icon: <WhatsAppOutlined />, color: '#25D366', label: 'WhatsApp' },
      { icon: <FacebookOutlined />, color: '#1877F2', label: 'Facebook' },
      { icon: <LinkedinOutlined />, color: '#0077B5', label: 'LinkedIn' }
    ]
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className={`ecard-container ${darkMode ? 'dark' : ''}`}>
      {/* Header */}
      <div className="ecard-header">
        <div className="profile-section">
          <div className="profile-image-wrapper">
            <img 
              src="https://placehold.co/100x100/000/fff?text=OM" 
              alt="Oscar Mendez Profile" 
              className="profile-image"
            />
          </div>
          <div className="company-info">
            <div className="company-logo">
              <img 
                src="https://placehold.co/40x40/000/fff?text=ED" 
                alt="Empresa Digital Logo" 
                className="company-logo-img"
              />
            </div>
            <div className="company-name">EMPRESA DIGITAL</div>
          </div>
        </div>
        
        {/* Top right icons */}
        <div className="top-right-icons">
          <button 
            onClick={toggleDarkMode}
            className="theme-toggle"
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button className="share-button" aria-label="Share">
            <ShareAltOutlined />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ecard-main">
        {/* Background Image with overlay */}
        <div className="background-overlay">
          <img 
            src="https://placehold.co/600x800/1a1a1a/ffffff?text=Background+Image" 
            alt="Background" 
            className="background-image"
          />
          
          {/* Main profile image */}
          <div className="main-profile">
            <img 
              src="https://placehold.co/300x400/000/fff?text=Oscar+Mendez" 
              alt="Oscar Mendez" 
              className="main-profile-img"
            />
          </div>
          
          {/* Wolf image */}
          <div className="animal-image">
            <img 
              src="https://placehold.co/200x300/1a1a1a/fff?text=Wolf" 
              alt="Wolf" 
              className="animal-img"
            />
          </div>
        </div>

        {/* Content Overlay */}
        <div className="content-overlay">
          <div className="name-title">
            <div className="title">{contactData.title}</div>
            <div className="name">{contactData.name}</div>
            <div className="tagline">{contactData.tagline}</div>
          </div>

          {/* Contact Info */}
          <div className="contact-info">
            <div className="info-item">
              <MailOutlined style={{ color: '#999' }} />
              <span>{contactData.email}</span>
            </div>
            <div className="info-item">
              <PhoneOutlined style={{ color: '#999' }} />
              <span>{contactData.phone}</span>
            </div>
            <div className="info-item">
              <GlobalOutlined style={{ color: '#999' }} />
              <span>{contactData.website}</span>
            </div>
            <div className="info-item">
              <EnvironmentOutlined style={{ color: '#999' }} />
              <span>{contactData.address}</span>
            </div>
          </div>

          {/* Social Media Icons */}
          <div className="social-media">
            {contactData.socialMedia.map((social, index) => (
              <button 
                key={index} 
                className="social-icon"
                style={{ backgroundColor: social.color }}
                aria-label={social.label}
              >
                {social.icon}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button className="save-contact-btn">
              GUARDAR CONTACTO
            </button>
            <button className="share-link-btn">
              COMPARTIR LINK
            </button>
          </div>

          {/* Sharing Icons */}
          <div className="sharing-icons">
            {contactData.sharingIcons.map((icon, index) => (
              <button 
                key={index} 
                className="sharing-icon"
                style={{ backgroundColor: icon.color }}
                aria-label={icon.label}
              >
                {icon.icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* QR Code Section */}
      <div className="qr-code-section">
        <button 
          className="qr-toggle-btn"
          onClick={() => setShowQR(!showQR)}
          aria-label={showQR ? "Hide QR code" : "Show QR code"}
        >
          <QrcodeOutlined />
        </button>
        {showQR && (
          <div className="qr-code-container">
            <img 
              src="https://placehold.co/150x150/000/fff?text=QR+Code" 
              alt="QR Code" 
              className="qr-code"
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="ecard-footer">
        <div className="footer-content">
          <div className="footer-text">© 2024 Oscar Mendez - Empresa Digital</div>
        </div>
      </div>
    </div>
  );
};

export default ECard;