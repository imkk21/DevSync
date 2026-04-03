import { supabaseAdmin } from '../config/supabase.js';

export async function getProfile(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function updateProfile(req, res) {
  try {
    const { display_name, avatar_url } = req.body;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ display_name, avatar_url })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
