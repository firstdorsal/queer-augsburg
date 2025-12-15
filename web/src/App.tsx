import "@fontsource-variable/inter";
import { Component } from "preact";
import { lazy, Suspense } from "preact/compat";
import Router, { route } from "preact-router";
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
import Admin from "./pages/Admin";
import Ich from "./pages/Ich";
import Impressum from "./pages/Impressum";
import { G, UiConfig } from "./types";
import { prefersDarkMode } from "./utils";

// Lazy load quiz components - only loaded when /quiz/* routes are accessed
const LazyQuizBoard = lazy(() => import("./quiz/QuizBoard"));
const LazyQuizControl = lazy(() => import("./quiz/QuizControl"));

// Route wrapper components that handle Suspense
function QuizBoardRoute(_props: { path?: string }) {
    return (
        <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Lädt...</div>}>
            <LazyQuizBoard />
        </Suspense>
    );
}

function QuizControlRoute(_props: { path?: string }) {
    return (
        <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Lädt...</div>}>
            <LazyQuizControl />
        </Suspense>
    );
}

interface AppProps {}
interface AppState {
    g: G;
    isQuizRoute: boolean;
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
        const isQuizRoute = window.location.pathname.startsWith('/quiz');
        this.state = {
            g: {
                uiConfig: null,
                qaClient: null,
                loggedIn: null,
                account: null,
                ref,
                meetingId
            },
            isQuizRoute
        };
    }

    handleRoute = (e: { url: string }) => {
        const isQuizRoute = e.url.startsWith('/quiz');
        if (isQuizRoute !== this.state.isQuizRoute) {
            this.setState({ isQuizRoute });
        }
    };

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
        const { isQuizRoute } = this.state;

        return (
            <div className="App">
                <CustomProvider theme={prefersDarkMode() ? "dark" : "light"}>
                    {!isQuizRoute && (
                        <div className="Header">
                            <Logo />
                            <Nav g={this.state.g} />
                        </div>
                    )}

                    <div className={isQuizRoute ? "Page Page--fullscreen" : "Page"}>
                        <Router onChange={this.handleRoute}>
                            <Treffen g={this.state.g} path="/" />
                            <Wir g={this.state.g} path="/wir" />
                            <Kontakt path="/kontakt" />
                            <Ich g={this.state.g} path="/ich" />
                            <Admin g={this.state.g} path="/admin" />
                            <Impressum path="/impressum" />
                            <QuizBoardRoute path="/quiz/board" />
                            <QuizControlRoute path="/quiz/control" />
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
