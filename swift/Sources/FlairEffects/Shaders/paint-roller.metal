// flair-metal-hash: aba34cba
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

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
    uint uUsePaint;
    char _m14_pad[12];
    packed_float3 uPaint;
    float uStipple;
    float uDrips;
    uint uAnimate;
    float uProgress;
    char _m19_pad[4];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_paint_roller_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _240)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_240.uBackdrop) * _240.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_240.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _240)
{
    float4 _377;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _377 = overBackdrop(param, _240);
    }
    else
    {
        float2 param_1 = fract(uv);
        _377 = float4(testCard(param_1), 1.0);
    }
    return _377;
}

static inline __attribute__((always_inline))
float4 paintOf(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _240)
{
    float4 _402;
    if (_240.uUsePaint != 0u)
    {
        _402 = float4(_240.uPaint[0], _240.uPaint[1], _240.uPaint[2], 1.0);
    }
    else
    {
        float2 param = uv;
        _402 = pictureRGBA(tex, texSmplr, param, _240);
    }
    return _402;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _240, texture2d<float> uTo, sampler uToSmplr, texture2d<float> uFrom, sampler uFromSmplr)
{
    float2 uv = fragCoord / float2(_240.iResolution[0], _240.iResolution[1]);
    float px = 1.0 / _240.iResolution[1u];
    float aspect = _240.iResolution[0u] / _240.iResolution[1u];
    float2 P = float2(uv.x * aspect, uv.y);
    float t = mod(_240.iTime, 6.0);
    bool second = (_240.uAnimate != 0u) && (t >= 3.0);
    float _461;
    if (_240.uAnimate != 0u)
    {
        _461 = smoothstep(0.25, 2.75, t - (second ? 3.0 : 0.0));
    }
    else
    {
        _461 = _240.uProgress;
    }
    float prog = _461;
    float4 _478;
    if (second)
    {
        float2 param = uv;
        _478 = paintOf(uTo, uToSmplr, param, _240);
    }
    else
    {
        float2 param_1 = uv;
        _478 = pictureRGBA(uFrom, uFromSmplr, param_1, _240);
    }
    float4 below = _478;
    float4 _493;
    if (second)
    {
        float2 param_2 = uv;
        _493 = pictureRGBA(uFrom, uFromSmplr, param_2, _240);
    }
    else
    {
        float2 param_3 = uv;
        _493 = paintOf(uTo, uToSmplr, param_3, _240);
    }
    float4 fresh = _493;
    float edge = mix(1.0880000591278076171875, -0.0599999986588954925537109375, prog);
    float seed = second ? 7.0 : 0.0;
    float2 param_4 = float2(P.x * 40.0, P.y * 25.0) + float2(seed);
    float nap = vnoise(param_4);
    float2 param_5 = float2((P.x * 9.0) + seed, 1.0);
    int param_6 = 3;
    float _539 = fbm(param_5, param_6);
    float e = (edge + (0.01200000010430812835693359375 * (_539 - 0.5))) + (0.0040000001899898052215576171875 * (nap - 0.5));
    float dist = P.y - e;
    float cover = fast::clamp((dist / px) + 0.5, 0.0, 1.0);
    float2 param_7 = (P * 260.0) + float2(seed);
    float2 param_8 = (P * 90.0) + float2(seed);
    float grain = (vnoise(param_7) * 0.60000002384185791015625) + (vnoise(param_8) * 0.4000000059604644775390625);
    float s = fast::clamp(dist / ((0.0900000035762786865234375 * _240.uStipple) + 0.001000000047497451305389404296875), 0.0, 1.0);
    cover *= smoothstep(-0.0599999986588954925537109375, 0.0599999986588954925537109375, (s * 1.2000000476837158203125) - grain);
    float2 cell = floor(P * 55.0);
    float2 param_9 = cell + float2(seed);
    float2 hs = hash22(param_9);
    float speck = (length(((P * 55.0) - cell) - hs) - 0.0599999986588954925537109375) - ((0.119999997317790985107421875 * hs.x) * hs.y);
    float2 param_10 = (cell + float2(3.099999904632568359375)) + float2(seed);
    float ahead = (smoothstep(-0.07999999821186065673828125, 0.0, dist) * step(0.7200000286102294921875, hash12(param_10))) * _240.uStipple;
    cover = fast::max(cover, fast::clamp(0.5 - (speck / (55.0 * px)), 0.0, 1.0) * ahead);
    float4 col = mix(below, fresh, float4(cover));
    float wet = exp((-fast::max(dist, 0.0)) / 0.119999997317790985107421875) * step(0.0, dist);
    float4 _676 = col;
    float3 _678 = _676.xyz * (1.0 + ((0.07999999821186065673828125 * (nap - 0.5)) * wet));
    col.x = _678.x;
    col.y = _678.y;
    col.z = _678.z;
    float4 _688 = col;
    float3 _691 = _688.xyz + float3(0.0500000007450580596923828125 * wet);
    col.x = _691.x;
    col.y = _691.y;
    col.z = _691.z;
    float yr = (edge - 0.039999999105930328369140625) + 0.004999999888241291046142578125;
    float under = (yr - 0.039999999105930328369140625) - P.y;
    float4 _721 = col;
    float3 _723 = _721.xyz * (1.0 - ((0.3499999940395355224609375 * exp((-fast::max(under, 0.0)) / 0.0199999995529651641845703125)) * step(0.0, under)));
    col.x = _723.x;
    col.y = _723.y;
    col.z = _723.z;
    float column = floor((P.x / aspect) * 16.0);
    float2 param_11 = float2(column + seed, 2.900000095367431640625);
    float2 hd = hash22(param_11);
    if (hd.y < _240.uDrips)
    {
        float x = (((column + 0.25) + (0.5 * hd.x)) / 16.0) * aspect;
        float2 param_12 = float2(column, seed + 5.0);
        float len = 0.014999999664723873138427734375 + (((0.100000001490116119384765625 * hash12(param_12)) * _240.uDrips) * smoothstep(0.0, 0.25, prog));
        float w = 0.0024999999441206455230712890625 + (0.00200000009499490261077880859375 * hd.x);
        float2 a = float2(x, yr - 0.0280000008642673492431640625);
        float2 b = float2(x, a.y - len);
        float hh = fast::clamp((a.y - P.y) / len, 0.0, 1.0);
        float dd = length(P - mix(a, b, float2(hh))) - (w * mix(1.39999997615814208984375, 0.800000011920928955078125, hh));
        dd = fast::min(dd, length(P - b) - (w * 1.7000000476837158203125));
        float drip = fast::clamp(0.5 - (dd / px), 0.0, 1.0);
        float3 _844;
        if (second)
        {
            float2 param_13 = float2(uv.x, fast::clamp(edge, 0.0, 1.0));
            _844 = pictureRGBA(uFrom, uFromSmplr, param_13, _240).xyz;
        }
        else
        {
            float2 param_14 = float2(uv.x, fast::clamp(edge, 0.0, 1.0));
            _844 = paintOf(uTo, uToSmplr, param_14, _240).xyz;
        }
        float3 paint = _844;
        paint *= (0.85000002384185791015625 + (0.4000000059604644775390625 * exp(-powr(((P.x - x) + (w * 0.4000000059604644775390625)) / w, 2.0))));
        col = mix(col, float4(fast::min(paint, float3(1.0)), 1.0), float4(drip));
    }
    float v = (P.y - yr) / 0.039999999105930328369140625;
    if (abs(v) < 1.0)
    {
        float roll = asin(fast::clamp(v, -1.0, 1.0)) + (edge * 40.0);
        float2 param_15 = float2(P.x * 140.0, roll * 5.0);
        float2 param_16 = float2(P.x * 50.0, roll * 2.0);
        float fuzz = (vnoise(param_15) * 0.60000002384185791015625) + (vnoise(param_16) * 0.4000000059604644775390625);
        float3 load = float3(0.0);
        float3 _955;
        for (int k = 0; k < 6; k++)
        {
            float2 at = float2((float(k) + 0.5) / 6.0, fast::clamp(edge + 0.039999999105930328369140625, 0.0, 1.0));
            if (second)
            {
                float2 param_17 = at;
                _955 = pictureRGBA(uFrom, uFromSmplr, param_17, _240).xyz;
            }
            else
            {
                float2 param_18 = at;
                _955 = paintOf(uTo, uToSmplr, param_18, _240).xyz;
            }
            load += (_955 / float3(6.0));
        }
        float3 r = (mix(load, float3(0.949999988079071044921875), float3(0.100000001490116119384765625)) * (0.3499999940395355224609375 + (0.64999997615814208984375 * sqrt(1.0 - (v * v))))) * (0.800000011920928955078125 + (0.4000000059604644775390625 * fuzz));
        r += float3(0.119999997317790985107421875 * powr(fast::max(1.0 - (abs(v - 0.449999988079071044921875) * 3.0), 0.0), 2.0));
        float m = fast::clamp(((1.0 - abs(v)) * 0.039999999105930328369140625) / px, 0.0, 1.0);
        col = mix(col, float4(fast::min(r, float3(1.0)), 1.0), float4(m));
    }
    fragColor = col;
}

fragment flair_paint_roller_frag_out flair_paint_roller_frag(constant FlairUniforms& _240 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_paint_roller_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1035;
    if (_240.flair_flipY > 0.5)
    {
        _1035 = _240.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1035 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1035);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _240, uTo, uToSmplr, uFrom, uFromSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

