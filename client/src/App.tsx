import { useEffect, useState } from 'react';
import Readability from './Readability';

const App = () => {
  const [message, setMessage] = useState('Loading...');

  useEffect(() => {
    fetch('/api/')
      .then((res) => res.text())
      .then((data) => setMessage(data));
  }, []);

  return (
    <div>
      <h1>Read To Me Later</h1>
      <p>From API: {message}</p>
      <Readability />
    </div>
  );
};

export default App;
