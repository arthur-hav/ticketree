import React from 'react';
import ReactDOM from 'react-dom';
import './css/common.css';
import DataProvider from './data.js'
import Login from './login.js'
import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

class App extends React.Component {

  render() {
    return (
      <BrowserRouter>
        <Routes>
          <Route index element={<Login />} />
          <Route path="tickets" element={<DataProvider />} />
        </Routes>
      </BrowserRouter>
    );
  }
}

// ========================================

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

// ========================================