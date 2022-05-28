import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import DataProvider from './data.js'
class App extends React.Component {

  render() {
    return (
      <div className="app">
        <DataProvider/>
      </div>
    );
  }
}

// ========================================

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

// ========================================