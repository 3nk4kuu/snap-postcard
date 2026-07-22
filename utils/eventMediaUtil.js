import { supabase } from '../supabaseClient';

// GET MEDIA
// pulls url from supabase

// pass the event id to get an array of image objects.
// const gallery = await getEventMedia(eventId); 
// should return [{ id: 1, media: "https://..." }]
export async function getEventMedia(eventId) {
  if (!eventId) return [];
  try {
    const { data, error } = await supabase
      .from('event_media')
      .select('id, media')
      .eq('event_id', eventId);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching event media:', error.message);
    return []; 
  }
}

// UPLOAD MEDIA
// pushes to bucket on supabase

// pass the local file URI and the target folder name
// const publicUrl = await uploadImageToSupabase(localUri, 'uploaded-media');
// should return "https://..." then remember to insert URL into event media table
export async function uploadImageToSupabase(fileUri, folderName = 'uploaded-media') {
  try {
    const fileExt = fileUri.substring(fileUri.lastIndexOf('.') + 1);
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${folderName}/${fileName}`;

    const response = await fetch(fileUri);
    const blob = await response.blob();

    const { error: uploadError } = await supabase.storage
      .from('event-media')
      .upload(filePath, blob, { contentType: `image/${fileExt}` });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('event-media')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Upload failed:', error.message);
    return null;
  }
}