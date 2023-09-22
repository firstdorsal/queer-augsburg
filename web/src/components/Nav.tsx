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
        name: "Ich",
        href: "/ich"
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

                    {this.props.g.admin && (
                        <li>
                            <Link draggable={false} activeClassName="active" href={"/admin"}>
                                Admin
                            </Link>
                        </li>
                    )}
                </ul>
            </nav>
        );
    };
}
