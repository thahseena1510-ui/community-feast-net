INSERT INTO public.user_roles (user_id, role)
VALUES ('4af30ad7-19a5-4e20-8796-8fc1b1ef150f', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;