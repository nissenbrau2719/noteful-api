CREATE FUNCTION update_modified() 
  RETURNS TRIGGER AS $$
BEGIN
  NEW.modified = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_modified
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE PROCEDURE update_modified();