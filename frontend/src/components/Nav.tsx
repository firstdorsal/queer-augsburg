import { Component } from "preact";
import { Link } from "preact-router/match";

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

interface NavProps {}
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
                </ul>
            </nav>
        );
    };
}
