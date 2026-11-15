import { describe, expect, it } from "vitest";
import { emailRule, requiredRule } from "./fieldRules";

describe("requiredRule", () => {
    it("refuses empty and blank values", () => {
        expect(requiredRule("")).not.toBeNull();
        expect(requiredRule("   ")).not.toBeNull();
    });

    it("accepts text", () => {
        expect(requiredRule("Anna")).toBeNull();
    });
});

describe("emailRule", () => {
    it.each(["anna@example.org", "anna.m+qa@sub.example.org"])("accepts %s", (address) => {
        expect(emailRule(address)).toBeNull();
    });

    it.each(["kein-mail", "a@b", "a b@example.org", "a@example.o"])("refuses %s", (address) => {
        expect(emailRule(address)).not.toBeNull();
    });

    it("asks for the address when it is empty", () => {
        expect(emailRule("")).toBe(requiredRule(""));
    });
});
