const wrapper = document.querySelector('.wrapper');
const registerBtn = document.querySelector('.register-btn');
const loginBtn = document.querySelector('.login-btn');

registerBtn.addEventListener('click', () => {
  wrapper.classList.add('active');
});

loginBtn.addEventListener('click', () => {
  wrapper.classList.remove('active');
});
