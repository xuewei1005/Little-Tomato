import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/app/App';
import { PetWindow } from './ui/pet/PetWindow';
import './ui/theme/tokens.css';
import './ui/pet/pet.css';

const root = document.getElementById('root');
if (!root) throw new Error('找不到应用根节点');

const isPetWindow = window.location.hash === '#pet';
if (isPetWindow) document.documentElement.dataset.window = 'pet';
createRoot(root).render(<StrictMode>{isPetWindow ? <PetWindow /> : <App />}</StrictMode>);
