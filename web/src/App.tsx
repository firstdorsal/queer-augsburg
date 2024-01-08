import { Component } from "preact";
import Router from "preact-router";
import Nav from "./components/Nav";
import Redirect from "./components/Redirect";
import Treffen from "./pages/Treffen";
import Wir from "./pages/Wir";
import Kontakt from "./pages/Kontakt";
import Logo from "./components/Logo";
import "@fontsource-variable/inter/slnt.css";

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
        /*
        try {
            navigator.serviceWorker.getRegistrations().then(function (registrations) {
                for (let registration of registrations) {
                    registration.unregister();
                }
            });
        } catch (e) {
            console.log(e);
        }
        */

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

        await client.create_own_user().catch(() => {
            this.setState(state => {
                return update(state, {
                    g: {
                        loggedIn: { $set: false },
                        admin: { $set: false }
                    }
                });
            });
        });

        // await timeout
        // in ff this is needed to prevent a bug where the user is not logged in
        await new Promise(resolve => setTimeout(resolve, 200));

        client
            .get_own_user()
            .then(account => {
                this.setState(state => {
                    return update(state, {
                        g: {
                            loggedIn: { $set: true },
                            admin: { $set: account?.admin ?? false }
                        }
                    });
                });
            })
            .catch(async () => {
                this.setState(state => {
                    return update(state, {
                        g: {
                            loggedIn: { $set: false },
                            admin: { $set: false }
                        }
                    });
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
                            <Kontakt path="/kontakt" />
                            <Ich g={this.state.g} path="/ich" />
                            <Admin g={this.state.g} path="/admin" />
                            <Impressum path="/impressum" />
                            <Redirect
                                external={true}
                                path="/data/"
                                to="https://cloud.vindelicum.eu/s/rnTcKo9zrRkXR25"
                            />
                            <Redirect
                                external={true}
                                path="/shop/"
                                to="https://queer-augsburg.myspreadshop.de/"
                            />
                        </Router>
                    </div>
                </CustomProvider>
            </div>
        );
    };
}
