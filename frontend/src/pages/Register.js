import React from 'react';
import Signup from './Signup';

const Register = ({ onAuthSuccess }) => {
  return <Signup onAuthSuccess={onAuthSuccess} />;
};

export default Register;