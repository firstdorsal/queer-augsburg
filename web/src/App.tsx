import "@fontsource-variable/inter";
import { Component } from "preact";
import Router from "preact-router";
import Logo from "./components/Logo";
import Nav from "./components/Nav";
import Redirect from "./components/Redirect";
import Kontakt from "./pages/Kontakt";
import Treffen from "./pages/Treffen";
import Wir from "./pages/Wir";

import update from "immutability-helper";
import { CustomProvider } from "rsuite";
import "rsuite/styles/index.less";
import { QaClient } from "./api";
import LocationPicker from "./components/LocationPicker";
import Admin from "./pages/Admin";
import Ich from "./pages/Ich";
import Impressum from "./pages/Impressum";
import { G, UiConfig } from "./types";
import { prefersDarkMode } from "./utils";

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
                account: null,
                ref,
                meetingId
            }
        };
    }

    componentDidMount = async () => {
        const uiConfig: UiConfig = await fetch("/config.json").then((res) => res.json());

        const client = new QaClient(
            uiConfig.qaServerAddress,
            uiConfig.interosseaServerAddress,
            uiConfig.interosseaWebAddress,
            "qa",
            uiConfig.skipInterossea
        );

        await client.init().catch(() => {});

        this.setState((state) => {
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
            this.setState((state) => {
                return update(state, {
                    g: {
                        loggedIn: { $set: false },
                        account: { $set: null }
                    }
                });
            });
        });

        // await timeout
        // in ff this is needed to prevent a bug where the user is not logged in
        await new Promise((resolve) => setTimeout(resolve, 200));

        client
            .get_own_user()
            .then((account) => {
                this.setState((state) => {
                    return update(state, {
                        g: {
                            loggedIn: { $set: true },
                            account: { $set: account ?? false }
                        }
                    });
                });
            })
            .catch(async () => {
                this.setState((state) => {
                    return update(state, {
                        g: {
                            loggedIn: { $set: false },
                            account: { $set: null }
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

                    <LocationPicker
                        onClose={() => {}}
                        onLocationSelect={() => {}}
                        show
                        lat={48}
                        lon={10}
                    ></LocationPicker>

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
