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
        name: "Verein",
        href: "/verein"
    },
    {
        name: "Kontakt",
        href: "/kontakt"
    }
];

interface NavProps {
    readonly g: G;
}
interface NavState {}
export default class Nav extends Component<NavProps, NavState> {
    render = () => {
        console.log(this.props.g);

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

                    {this.props.g.loggedIn && (
                        <li>
                            <Link draggable={false} activeClassName="active" href={"/ich"}>
                                Ich
                            </Link>
                        </li>
                    )}

                    <li>
                        {this.props.g.loggedIn ? (
                            <a
                                href={`${this.props.g.uiConfig?.interosseaWebAddress}/logout?rid=qa`}
                            >
                                Logout
                            </a>
                        ) : (
                            <a href={`${this.props.g.uiConfig?.interosseaWebAddress}/login?rid=qa`}>
                                Login
                            </a>
                        )}
                    </li>
                </ul>
            </nav>
        );
    };
}
