const { signup, login, getProfile, updateProfile } = require('./authController');

module.exports = {
  registerUser: signup,
  loginUser: login,
  getUserProfile: getProfile,
  updateUserProfile: updateProfile,
};