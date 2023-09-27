import { Component } from "preact";
import Router from "preact-router";
import Nav from "./components/Nav";
import Redirect from "./components/Redirect";
import Treffen from "./pages/Treffen";
import Wir from "./pages/Wir";
import Verein from "./pages/Verein";
import Kontakt from "./pages/Kontakt";
import Logo from "./components/Logo";
import "@fontsource/inter/700.css";
import "@fontsource/inter/400.css";
import { QaClient } from "./api";
import { G, UiConfig } from "./types";
import update from "immutability-helper";
import Ich from "./pages/Ich";
import "rsuite/styles/index.less";
import { CustomProvider } from "rsuite";
import Admin from "./pages/Admin";
import { prefersDarkMode } from "./utils";
import Impressum from "./pages/Impressum";

interface AppProps {}
interface AppState {
    g: G;
}

export default class App extends Component<AppProps, AppState> {
    constructor(props: AppProps) {
        try {
            navigator.serviceWorker.getRegistrations().then(function (registrations) {
                for (let registration of registrations) {
                    registration.unregister();
                }
            });
        } catch (e) {
            console.log(e);
        }

        // parse ref query parameter and save it to localStorage
        const urlParams = new URLSearchParams(window.location.search);
        let ref = urlParams.get("ref");
        if (ref) {
            localStorage.setItem("ref", ref);
        } else {
            ref = localStorage.getItem("ref");
        }

        const meetingId = urlParams.get("m");

        super(props);
        this.state = {
            g: {
                uiConfig: null,
                qaClient: null,
                loggedIn: null,
                admin: null,
                ref,
                meetingId
            }
        };
    }

    componentDidMount = async () => {
        const uiConfig: UiConfig = await fetch("/config.json").then(res => res.json());

        const client = new QaClient(
            uiConfig.qaServerAddress,
            uiConfig.interosseaServerAddress,
            uiConfig.interosseaWebAddress,
            "qa",
            uiConfig.skipInterossea
        );

        await client.init().catch(() => {});

        client
            .create_own_user()
            .then(async () => {
                const account = await client.get_own_user();
                this.setState(state => {
                    return update(state, {
                        g: {
                            loggedIn: { $set: true },
                            admin: { $set: account.admin }
                        }
                    });
                });
            })
            .catch(() => {
                this.setState(state => {
                    return update(state, {
                        g: {
                            loggedIn: { $set: false },
                            admin: { $set: false }
                        }
                    });
                });
            });

        this.setState(state => {
            return update(state, {
                g: {
                    uiConfig: { $set: uiConfig },
                    qaClient: {
                        $set: client
                    }
                }
            });
        });
    };

    render = () => {
        return (
            <div className="App">
                <CustomProvider theme={prefersDarkMode() ? "dark" : "light"}>
                    <div className="Header">
                        <Logo />
                        <Nav g={this.state.g} />
                    </div>

                    <div className="Page">
                        <Router>
                            <Treffen g={this.state.g} path="/" />
                            <Wir g={this.state.g} path="/wir" />
                            <Verein path="/verein" />
                            <Kontakt path="/kontakt" />
                            <Ich g={this.state.g} path="/ich" />
                            <Admin g={this.state.g} path="/admin" />
                            <Impressum path="/impressum" />
                            <Redirect default to="/" />
                        </Router>
                    </div>
                </CustomProvider>
            </div>
        );
    };
}
