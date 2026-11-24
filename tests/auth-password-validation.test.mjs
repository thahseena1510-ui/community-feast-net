import { expect, test } from "bun:test";
import { passwordSchema } from "../src/lib/password-validation.ts";

const validPassword = "GoodPass1!";

test("requires at least 8 characters", () => {
  expect(passwordSchema.safeParse("Aa1!").success).toBe(false);
});

test("requires an uppercase letter", () => {
  expect(passwordSchema.safeParse("lowercase1!").success).toBe(false);
});

test("requires a lowercase letter", () => {
  expect(passwordSchema.safeParse("UPPERCASE1!").success).toBe(false);
});

test("requires a number", () => {
  expect(passwordSchema.safeParse("GoodPass!").success).toBe(false);
});

test("requires a special character", () => {
  expect(passwordSchema.safeParse("GoodPass1").success).toBe(false);
});

test("accepts a password meeting all requested rules", () => {
  expect(passwordSchema.safeParse(validPassword).success).toBe(true);
});