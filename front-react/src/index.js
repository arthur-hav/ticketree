import React from 'react';
import ReactDOM from 'react-dom';
import './css/common.css';
import DataProvider from './tickets.js'
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
          <Route path="tickets" element={<DataProvider obj='tickets' />} />
          <Route path="users" element={<DataProvider obj='profiles' />} />
        </Routes>
      </BrowserRouter>
    );
  }
}

// ========================================

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

// ========================================