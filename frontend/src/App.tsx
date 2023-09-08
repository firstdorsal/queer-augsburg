import { Component } from "preact";
import Router from "preact-router";
import Nav from "./components/Nav";
import Redirect from "./components/Redirect";
import Treffen from "./pages/Treffen";
import Wir from "./pages/Wir";
import Verein from "./pages/Verein";
import Kontakt from "./pages/Kontakt";
import Logo from "./components/Logo";
import "@fontsource/inter/600.css";
import "@fontsource/inter/400.css";

interface AppProps {}
interface AppState {}
export default class App extends Component<AppProps, AppState> {
    render = () => {
        return (
            <div className="App">
                <div className="Header">
                    <Logo></Logo>
                    <Nav></Nav>
                </div>

                <div className="Page">
                    <Router>
                        <Treffen path="/">Treffen</Treffen>
                        <Wir path="/wir">Wir</Wir>
                        <Verein path="/verein">Verein</Verein>
                        <Kontakt path="/kontakt">Kontakt</Kontakt>
                        <Redirect default to="/"></Redirect>
                    </Router>
                </div>
            </div>
        );
    };
}
