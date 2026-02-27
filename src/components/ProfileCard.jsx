import React from 'react';

const ProfileCard = ({ hit }) => (
  <div className="profile-card" style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>
    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
      <img src={hit.profilePhotoUrl} alt="" style={{ width: '60px', borderRadius: '50%' }} />
      <div>
        <h3 style={{ margin: 0 }}>{hit.fullName}</h3>
        <p style={{ margin: '5px 0', color: '#666' }}>{hit.profession}</p>
        <small>{hit.kovil} • {hit.nativePlace}</small>
      </div>
    </div>
  </div>
);

export default ProfileCard;
