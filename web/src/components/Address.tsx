import { Component } from "preact";

interface AddressProps {}
interface AddressState {}
export default class Address extends Component<AddressProps, AddressState> {
    render = () => {
        return (
            <p className="Address">
                Queer Augsburg e.V.
                <br />
                Postfach 10 22 07
                <br />
                86012 Augsburg
            </p>
        );
    };
}
