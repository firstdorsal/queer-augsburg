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

interface AppProps {}
interface AppState {
    g: G;
}
export default class App extends Component<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {
            g: {
                uiConfig: null,
                qaClient: null,
                loggedIn: false,
                admin: false
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
            .catch(() => {});

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
                <CustomProvider theme="dark">
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
                            <Redirect default to="/" />
                        </Router>
                    </div>
                </CustomProvider>
            </div>
        );
    };
}
