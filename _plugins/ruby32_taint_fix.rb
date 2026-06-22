# Ruby 3.2+ removed Object#tainted?/taint/untaint which older Liquid (4.0.x) still calls.
# This monkey-patch restores no-op versions for Jekyll compatibility.
class Object
  def tainted?
    false
  end

  def taint
    self
  end

  def untaint
    self
  end
end
