// flair-metal-hash: dedfb42f
#pragma clang diagnostic ignored "-Wmissing-prototypes"
#pragma clang diagnostic ignored "-Wmissing-braces"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

template<typename T, size_t Num>
struct spvUnsafeArray
{
    T elements[Num ? Num : 1];
    
    thread T& operator [] (size_t pos) thread
    {
        return elements[pos];
    }
    constexpr const thread T& operator [] (size_t pos) const thread
    {
        return elements[pos];
    }
    
    device T& operator [] (size_t pos) device
    {
        return elements[pos];
    }
    constexpr const device T& operator [] (size_t pos) const device
    {
        return elements[pos];
    }
    
    constexpr const constant T& operator [] (size_t pos) const constant
    {
        return elements[pos];
    }
    
    threadgroup T& operator [] (size_t pos) threadgroup
    {
        return elements[pos];
    }
    constexpr const threadgroup T& operator [] (size_t pos) const threadgroup
    {
        return elements[pos];
    }
};

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    packed_float3 uPhosphor;
    float uGain;
    float uGrain;
    float uBloom;
    float uVignette;
    float uEyes;
    float uEyeSize;
    uint uOsd;
    char _m21_pad[8];
    packed_float3 uOsdColor;
    float uClock;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

constant spvUnsafeArray<int, 10> _369 = spvUnsafeArray<int, 10>({ 63, 6, 91, 79, 102, 109, 125, 7, 127, 111 });

struct flair_night_vision_cam_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _164)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_164.uBackdrop) * _164.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_164.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _164)
{
    float4 _306;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _306 = overBackdrop(param, _164);
    }
    else
    {
        float2 param_1 = fract(uv);
        _306 = float4(testCard(param_1), 1.0);
    }
    return _306;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _164)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _164).xyz;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float eyePair(thread const float2& p, thread const float& i, thread const float& aspect, constant FlairUniforms& _164, texture2d<float> uImage, sampler uImageSmplr)
{
    float period = 5.0 + (2.0 * i);
    float life = (_164.iTime / period) + (0.37000000476837158203125 * i);
    float cycle = floor(life);
    float u = fract(life);
    float2 param = float2((cycle * 3.7000000476837158203125) + i, 11.0 + i);
    float2 h = hash22(param);
    float2 param_1 = float2(cycle, 5.0 + i);
    if (hash12(param_1) > _164.uEyes)
    {
        return 0.0;
    }
    float2 c = float2(((h.x - 0.5) * 0.800000011920928955078125) * aspect, (h.y - 0.5) * 0.60000002384185791015625);
    float2 param_2 = (c / float2(aspect, 1.0)) + float2(0.5);
    float dark = 1.0 - smoothstep(0.1500000059604644775390625, 0.5, dot(picture(uImage, uImageSmplr, param_2, _164), float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875)));
    float open = smoothstep(0.100000001490116119384765625, 0.25, u) * (1.0 - smoothstep(0.60000002384185791015625, 0.75, u));
    float blink = 1.0 - exp(-powr((u - 0.4199999868869781494140625) / 0.01200000010430812835693359375, 2.0));
    float r = _164.uEyeSize * 0.001000000047497451305389404296875;
    float2 q = p - c;
    q.x = abs(q.x) - (1.7000000476837158203125 * r);
    float shape = length(q / float2(1.0, fast::max(open * blink, 0.0199999995529651641845703125)));
    return (dark * open) * (smoothstep(r, 0.4000000059604644775390625 * r, shape) + (0.5 * exp((-shape) / (1.7999999523162841796875 * r))));
}

static inline __attribute__((always_inline))
float segDist(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 pa = p - a;
    float2 ba = b - a;
    return length(pa - (ba * fast::clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)));
}

static inline __attribute__((always_inline))
float letterDist(thread const float2& p, thread const int& k)
{
    float2 param = p;
    float2 param_1 = float2(0.0);
    float2 param_2 = float2(0.0, 2.0);
    float d = segDist(param, param_1, param_2);
    float2 param_3 = p;
    float2 param_4 = float2(0.0, 2.0);
    float2 param_5 = float2(1.0, 2.0);
    d = fast::min(d, segDist(param_3, param_4, param_5));
    if (k == 0)
    {
        float2 param_6 = p;
        float2 param_7 = float2(1.0, 2.0);
        float2 param_8 = float2(1.0);
        d = fast::min(d, segDist(param_6, param_7, param_8));
        float2 param_9 = p;
        float2 param_10 = float2(0.0, 1.0);
        float2 param_11 = float2(1.0);
        d = fast::min(d, segDist(param_9, param_10, param_11));
        float2 param_12 = p;
        float2 param_13 = float2(0.300000011920928955078125, 1.0);
        float2 param_14 = float2(1.0, 0.0);
        d = fast::min(d, segDist(param_12, param_13, param_14));
    }
    else
    {
        float2 param_15 = p;
        float2 param_16 = float2(0.0);
        float2 param_17 = float2(1.0, 0.0);
        d = fast::min(d, segDist(param_15, param_16, param_17));
        if (k == 1)
        {
            float2 param_18 = p;
            float2 param_19 = float2(0.0, 1.0);
            float2 param_20 = float2(0.800000011920928955078125, 1.0);
            d = fast::min(d, segDist(param_18, param_19, param_20));
        }
    }
    return d;
}

static inline __attribute__((always_inline))
float digit7(thread const float2& p, thread const int& d)
{
    int m = _369[clamp(d, 0, 9)];
    float dist = 100000.0;
    if ((m & 1) != 0)
    {
        float2 param = p;
        float2 param_1 = float2(0.0, 2.0);
        float2 param_2 = float2(1.0, 2.0);
        dist = fast::min(dist, segDist(param, param_1, param_2));
    }
    if ((m & 2) != 0)
    {
        float2 param_3 = p;
        float2 param_4 = float2(1.0, 2.0);
        float2 param_5 = float2(1.0);
        dist = fast::min(dist, segDist(param_3, param_4, param_5));
    }
    if ((m & 4) != 0)
    {
        float2 param_6 = p;
        float2 param_7 = float2(1.0);
        float2 param_8 = float2(1.0, 0.0);
        dist = fast::min(dist, segDist(param_6, param_7, param_8));
    }
    if ((m & 8) != 0)
    {
        float2 param_9 = p;
        float2 param_10 = float2(0.0);
        float2 param_11 = float2(1.0, 0.0);
        dist = fast::min(dist, segDist(param_9, param_10, param_11));
    }
    if ((m & 16) != 0)
    {
        float2 param_12 = p;
        float2 param_13 = float2(0.0);
        float2 param_14 = float2(0.0, 1.0);
        dist = fast::min(dist, segDist(param_12, param_13, param_14));
    }
    if ((m & 32) != 0)
    {
        float2 param_15 = p;
        float2 param_16 = float2(0.0, 1.0);
        float2 param_17 = float2(0.0, 2.0);
        dist = fast::min(dist, segDist(param_15, param_16, param_17));
    }
    if ((m & 64) != 0)
    {
        float2 param_18 = p;
        float2 param_19 = float2(0.0, 1.0);
        float2 param_20 = float2(1.0);
        dist = fast::min(dist, segDist(param_18, param_19, param_20));
    }
    return dist;
}

static inline __attribute__((always_inline))
float clockInk(thread const float2& q, thread const float& secs)
{
    bool _546 = q.y < (-0.300000011920928955078125);
    bool _554;
    if (!_546)
    {
        _554 = q.y > 2.2999999523162841796875;
    }
    else
    {
        _554 = _546;
    }
    bool _561;
    if (!_554)
    {
        _561 = q.x < (-0.300000011920928955078125);
    }
    else
    {
        _561 = _554;
    }
    bool _569;
    if (!_561)
    {
        _569 = q.x > 12.80000019073486328125;
    }
    else
    {
        _569 = _561;
    }
    if (_569)
    {
        return 0.0;
    }
    int slot = int(floor(q.x / 1.60000002384185791015625));
    float2 c = float2(q.x - (float(slot) * 1.60000002384185791015625), q.y);
    int h = int(mod(floor(secs / 3600.0), 24.0));
    int m = int(mod(floor(secs / 60.0), 60.0));
    int s = int(mod(floor(secs), 60.0));
    float dist = 100000.0;
    if ((slot == 2) || (slot == 5))
    {
        dist = fast::min(length(c - float2(0.5, 0.60000002384185791015625)), length(c - float2(0.5, 1.39999997615814208984375)));
    }
    else
    {
        int _633;
        if (slot < 2)
        {
            _633 = h;
        }
        else
        {
            _633 = (slot < 5) ? m : s;
        }
        int v = _633;
        int _654;
        if (((slot == 0) || (slot == 3)) || (slot == 6))
        {
            _654 = v / 10;
        }
        else
        {
            _654 = v - ((v / 10) * 10);
        }
        int d = _654;
        float2 param = c;
        int param_1 = d;
        dist = digit7(param, param_1);
    }
    return smoothstep(0.20000000298023223876953125, 0.119999997317790985107421875, dist);
}

static inline __attribute__((always_inline))
float2 camcorder(thread const float2& fragCoord, thread const float& unit, thread const float& secs, constant FlairUniforms& _164)
{
    float2 rec = (fragCoord - float2(unit * 4.19999980926513671875, _164.iResolution[1u] - (unit * 4.0))) / float2(unit);
    float white = 0.0;
    bool _696 = rec.y > (-0.300000011920928955078125);
    bool _702;
    if (_696)
    {
        _702 = rec.y < 2.2999999523162841796875;
    }
    else
    {
        _702 = _696;
    }
    bool _708;
    if (_702)
    {
        _708 = rec.x > (-0.300000011920928955078125);
    }
    else
    {
        _708 = _702;
    }
    bool _715;
    if (_708)
    {
        _715 = rec.x < 4.599999904632568359375;
    }
    else
    {
        _715 = _708;
    }
    if (_715)
    {
        int k = int(floor(rec.x / 1.60000002384185791015625));
        float2 param = rec - float2(float(k) * 1.60000002384185791015625, 0.0);
        int param_1 = k;
        white = smoothstep(0.20000000298023223876953125, 0.119999997317790985107421875, letterDist(param, param_1));
    }
    float spot = smoothstep(1.0, 0.85000002384185791015625, length((fragCoord - float2(unit * 2.599999904632568359375, _164.iResolution[1u] - (unit * 3.0))) / float2(unit)));
    float red = spot * step(0.5, fract(secs));
    float2 clock = (fragCoord - float2(_164.iResolution[0u] - (unit * 15.0), unit * 3.2000000476837158203125)) / float2(unit);
    float2 param_2 = clock;
    float param_3 = secs;
    white = fast::max(white, clockInk(param_2, param_3));
    return float2(white, red);
}

static inline __attribute__((always_inline))
float4 osdOver(thread float3& col, thread const float& alpha, thread const float2& fragCoord, thread const float& shift, constant FlairUniforms& _164)
{
    if (!(_164.uOsd != 0u))
    {
        return float4(col, alpha);
    }
    float unit = _164.iResolution[1u] * 0.017999999225139617919921875;
    float secs = (_164.uClock * 3600.0) + _164.iTime;
    float2 at = fragCoord + float2(shift, 0.0);
    float2 param = at + (float2(-0.25, 0.25) * unit);
    float param_1 = unit;
    float param_2 = secs;
    float2 shadow = camcorder(param, param_1, param_2, _164);
    float2 param_3 = at;
    float param_4 = unit;
    float param_5 = secs;
    float2 ink = camcorder(param_3, param_4, param_5, _164);
    col = mix(col, float3(0.0), float3(0.5 * fast::max(shadow.x, shadow.y)));
    col = mix(col, float3(_164.uOsdColor), float3(ink.x));
    col = mix(col, float3(1.0, 0.100000001490116119384765625, 0.07999999821186065673828125), float3(ink.y));
    return float4(col, fast::max(alpha, fast::max(0.5 * fast::max(shadow.x, shadow.y), fast::max(ink.x, ink.y))));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _164, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_164.iResolution[0], _164.iResolution[1]);
    float aspect = _164.iResolution[0u] / _164.iResolution[1u];
    float frame = floor(_164.iTime * 24.0);
    float2 param = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _164);
    float2 param_1 = float2(frame, 1.0);
    float flicker = 1.0 + (0.039999999105930328369140625 * (hash12(param_1) - 0.5));
    float l = 1.0 - exp((((-dot(pic.xyz, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875))) * _164.uGain) * 1.60000002384185791015625) * flicker);
    float d = 0.01200000010430812835693359375;
    float glow = 0.0;
    for (int k = 0; k < 4; k++)
    {
        float a = (float(k) * 1.57079994678497314453125) + 0.785000026226043701171875;
        float2 param_2 = uv + (float2(cos(a) / aspect, sin(a)) * d);
        glow += dot(picture(uImage, uImageSmplr, param_2, _164), float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    }
    l += ((_164.uBloom * 0.5) * smoothstep(0.3499999940395355224609375, 0.89999997615814208984375, (glow * 0.25) * _164.uGain));
    float2 param_3 = fragCoord + float2(frame * 23.1000003814697265625);
    float n = hash12(param_3);
    l += (((n - 0.5) * _164.uGrain) * (0.25 + (0.550000011920928955078125 * (1.0 - l))));
    float2 param_4 = (fragCoord * 0.730000019073486328125) + float2(frame);
    l += (step(0.99919998645782470703125, hash12(param_4)) * _164.uGrain);
    float2 p = (fragCoord - (float2(_164.iResolution[0], _164.iResolution[1]) * 0.5)) / float2(_164.iResolution[1u]);
    for (int i = 0; i < 3; i++)
    {
        float2 param_5 = p;
        float param_6 = float(i);
        float param_7 = aspect;
        l += (1.39999997615814208984375 * eyePair(param_5, param_6, param_7, _164, uImage, uImageSmplr));
    }
    l = fast::max(l, 0.0);
    float3 col = (float3(_164.uPhosphor) * l) + (float3(powr(fast::min(l, 1.2000000476837158203125), 4.0)) * 0.3499999940395355224609375);
    col *= (0.89999997615814208984375 + (0.100000001490116119384765625 * sin(fragCoord.y * 2.0)));
    float rim = length(p / float2(0.62000000476837158203125 * aspect, 0.62000000476837158203125));
    col *= (1.0 - (_164.uVignette * smoothstep(0.550000011920928955078125, 1.0499999523162841796875, rim)));
    float3 param_8 = fast::clamp(col, float3(0.0), float3(1.0));
    float param_9 = pic.w;
    float2 param_10 = fragCoord;
    float param_11 = 0.0;
    float4 _1242 = osdOver(param_8, param_9, param_10, param_11, _164);
    fragColor = _1242;
}

fragment flair_night_vision_cam_frag_out flair_night_vision_cam_frag(constant FlairUniforms& _164 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_night_vision_cam_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1254;
    if (_164.flair_flipY > 0.5)
    {
        _1254 = _164.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1254 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1254);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _164, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

