import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import DemoCompleto from './pages/DemoCompleto/DemoCompleto';
import './pages/DemoCompleto/DemoBase.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><BrowserRouter><DemoCompleto /></BrowserRouter></React.StrictMode>,
);
