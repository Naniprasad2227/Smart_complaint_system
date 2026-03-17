import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./services/api', () => ({
  authApi: {
    logout: jest.fn(),
  },
  complaintApi: {
    getMine: jest.fn(),
    getAll: jest.fn(),
    getAnalytics: jest.fn(),
    submit: jest.fn(),
    updateStatus: jest.fn(),
    uploadImage: jest.fn(),
  },
  default: {},
}));

describe('App routing shell', () => {
  test('renders home screen by default when not authenticated', () => {
    localStorage.clear();

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    expect(screen.getByRole('heading', { name: /National AI Complaint Command Dashboard/i })).toBeInTheDocument();
  });
});
