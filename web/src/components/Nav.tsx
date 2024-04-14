import { Component } from "preact";
import { Link } from "preact-router/match";
import { BsFillPersonFill } from "react-icons/bs";
import { G } from "../types";

const navItems = [
    {
        name: "Treffen",
        href: "/"
    },
    {
        name: "Wir",
        href: "/wir"
    },
    {
        name: "Kontakt",
        href: "/kontakt"
    },
    {
        name: "Impressum",
        href: "/impressum"
    }
];

interface NavProps {
    readonly g: G;
}
interface NavState {}
export default class Nav extends Component<NavProps, NavState> {
    render = () => {
        return (
            <nav className="Nav">
                <ul>
                    {navItems.map(item => {
                        return (
                            <li>
                                <Link draggable={false} activeClassName="active" href={item.href}>
                                    {item.name}
                                </Link>
                            </li>
                        );
                    })}
                    {(() => {
                        if (this.props.g.loggedIn) {
                            if (this.props.g.account?.capabilities?.includes(`GetUsers`)) {
                                return (
                                    <li>
                                        <Link
                                            draggable={false}
                                            activeClassName="active"
                                            href={"/admin"}
                                        >
                                            Admin
                                        </Link>
                                    </li>
                                );
                            } else {
                                return (
                                    <li>
                                        <Link
                                            draggable={false}
                                            activeClassName="active"
                                            href={"/ich"}
                                        >
                                            Ich
                                        </Link>
                                    </li>
                                );
                            }
                        } else {
                            return (
                                <li>
                                    <button
                                        draggable={false}
                                        onClick={() => {
                                            if (this.props.g.uiConfig) {
                                                window.location.href =
                                                    this.props.g.uiConfig.interosseaWebAddress +
                                                    "/login?rid=qa_ich";
                                            }
                                        }}
                                    >
                                        Login
                                    </button>
                                </li>
                            );
                        }
                    })()}
                </ul>
            </nav>
        );
    };
}
