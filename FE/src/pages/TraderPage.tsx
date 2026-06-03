import React from 'react';
import AIQuantPage from './AIQuantPage';

const TraderPage: React.FC<{ activeTicker: string }> = ({ activeTicker }) => {
  return <AIQuantPage activeTicker={activeTicker} />;
};

export default TraderPage;
