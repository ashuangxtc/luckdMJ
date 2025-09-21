import { Router, Route } from "wouter";
import GameScreen from "./screens/GameScreen";
import DrawPage from "./pages/Draw";
import AdminEnhanced from "./pages/AdminEnhanced";

export default function App() {
  return (
    <Router>
      <Route path="/" component={DrawPage} />
      <Route path="/draw" component={DrawPage} />
      <Route path="/admin" component={AdminEnhanced} />
      <Route path="/game" component={GameScreen} />
    </Router>
  );
}