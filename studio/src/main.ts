import { mount } from 'svelte';
import Shell from './Shell.svelte';
import './style.css';
import './home.css';

mount(Shell, { target: document.getElementById('app')! });
