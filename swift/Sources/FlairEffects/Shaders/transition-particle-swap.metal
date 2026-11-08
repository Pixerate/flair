// flair-metal-hash: 31d9f454
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
    uint uAnimate;
    float uProgress;
    float uParticle;
    float uScatter;
    float uSpin;
    float3 uBackground;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
    float uBackgroundAlpha;
};

struct flair_transition_particle_swap_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float progress(constant FlairUniforms& _166)
{
    float _332;
    if (_166.uAnimate != 0u)
    {
        _332 = smoothstep(0.100000001490116119384765625, 0.89999997615814208984375, 0.5 - (0.5 * cos((_166.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _332 = _166.uProgress;
    }
    return _332;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float2 landing(thread const float2& c)
{
    float2 block = floor(c * 0.5);
    float2 local = c - (block * 2.0);
    float _423;
    if (local.y < 0.5)
    {
        _423 = local.x;
    }
    else
    {
        _423 = 3.0 - local.x;
    }
    float i = _423;
    float2 param = block + float2(7.30000019073486328125);
    float turn = 1.0 + floor(hash12(param) * 2.999000072479248046875);
    float r = mod(i + turn, 4.0);
    return (block * 2.0) + float2(float((r > 0.5) && (r < 2.5)), float(r > 1.5));
}

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float2 coverScale(texture2d<float> tex, sampler texSmplr, constant FlairUniforms& _166)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    float frameAspect = _166.iResolution[0u] / _166.iResolution[1u];
    float _369;
    if (size.x > 1.0)
    {
        _369 = size.x / size.y;
    }
    else
    {
        _369 = frameAspect;
    }
    float imageAspect = _369;
    float2 _383;
    if (frameAspect > imageAspect)
    {
        _383 = float2(1.0, imageAspect / frameAspect);
    }
    else
    {
        _383 = float2(frameAspect / imageAspect, 1.0);
    }
    return _383;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _166)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_166.uBackdrop) * _166.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_166.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _166)
{
    float4 _307;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _307 = overBackdrop(param, _166);
    }
    else
    {
        float2 param_1 = fract(uv);
        _307 = float4(testCard(param_1), 1.0);
    }
    return _307;
}

static inline __attribute__((always_inline))
float4 coverRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _166)
{
    float2 param = float2(0.5) + ((uv - float2(0.5)) * coverScale(tex, texSmplr, _166));
    return pictureRGBA(tex, texSmplr, param, _166);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _166, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float t = progress(_166);
    float2 p = fragCoord / float2(_166.uParticle);
    float2 grid = float2(_166.iResolution[0], _166.iResolution[1]) / float2(_166.uParticle);
    float2 base = floor(p);
    float4 col = float4(_166.uBackground, _166.uBackdropAlpha);
    float top = -1.0;
    float2 hitFrom = float2(0.0);
    float2 hitTo = float2(0.0);
    float hitT = 0.0;
    float hitCover = 0.0;
    float reach = fast::max(0.707199990749359130859375, (0.60000002384185791015625 * abs(_166.uScatter + (_166.uSpin * 0.300000011920928955078125))) + 0.4950999915599822998046875) + 0.00999999977648258209228515625;
    float2 lo = fast::max(base - float2(2.0), ceil((p - float2(1.5)) - float2(reach)));
    float2 hi = fast::min(base + float2(2.0), floor((p + float2(0.5)) + float2(reach)));
    for (int j = 0; j < 5; j++)
    {
        if ((lo.y + float(j)) > hi.y)
        {
            break;
        }
        for (int i = 0; i < 5; i++)
        {
            if ((lo.x + float(i)) > hi.x)
            {
                break;
            }
            float2 c = lo + float2(float(i), float(j));
            float2 corner = c - (floor(c * 0.5) * 2.0);
            bool _613 = any(p < (((c + float2(0.5)) - corner) - float2(reach)));
            bool _628;
            if (!_613)
            {
                _628 = any(p > (((c + float2(1.5)) - corner) + float2(reach)));
            }
            else
            {
                _628 = _613;
            }
            if (_628)
            {
                continue;
            }
            float2 param = c;
            float2 h = hash22(param);
            float delay = 0.5 * ((0.550000011920928955078125 * fast::clamp(c.x / grid.x, 0.0, 1.0)) + (0.449999988079071044921875 * h.x));
            float k = smoothstep(0.0, 1.0, fast::clamp((t - delay) / 0.5, 0.0, 1.0));
            float lift = sin(3.141590118408203125 * k);
            float z = h.y + lift;
            if (z <= top)
            {
                continue;
            }
            float near = (((0.60000002384185791015625 * abs(_166.uScatter + (_166.uSpin * 0.300000011920928955078125))) * lift) + (0.707199990749359130859375 * (1.0 - (0.300000011920928955078125 * lift)))) + 0.00999999977648258209228515625;
            bool _701 = any(p < (((c + float2(0.5)) - corner) - float2(near)));
            bool _716;
            if (!_701)
            {
                _716 = any(p > (((c + float2(1.5)) - corner) + float2(near)));
            }
            else
            {
                _716 = _701;
            }
            if (_716)
            {
                continue;
            }
            float2 from = c + float2(0.5);
            float2 param_1 = c;
            float2 to = landing(param_1) + float2(0.5);
            float2 path = to - from;
            float2 side = fast::normalize(float2(-path.y, path.x) + ((h - float2(0.5)) * 0.800000011920928955078125));
            float2 pos = mix(from, to, float2(k)) + (((side * lift) * (_166.uScatter + (_166.uSpin * 0.300000011920928955078125))) * ((h.y > 0.5) ? 0.60000002384185791015625 : (-0.60000002384185791015625)));
            float size = 1.0 - (0.300000011920928955078125 * lift);
            float2 rel = p - pos;
            if (dot(rel, rel) > ((0.500999987125396728515625 * size) * size))
            {
                continue;
            }
            float angle = (((h.y - 0.5) * 6.28318023681640625) * _166.uSpin) * lift;
            float param_2 = -angle;
            float2 l = (rot(param_2) * rel) / float2(size);
            float m = fast::max(abs(l.x), abs(l.y));
            if (m <= 0.5)
            {
                top = z;
                hitFrom = from + l;
                hitTo = to + l;
                hitT = k;
                hitCover = 1.0 - (smoothstep(0.5 - (1.5 / _166.uParticle), 0.5, m) * fast::min(lift * 8.0, 1.0));
            }
        }
    }
    if (top > (-1.0))
    {
        float2 param_3 = hitFrom / grid;
        float2 param_4 = hitTo / grid;
        float4 particle = mix(coverRGBA(uFrom, uFromSmplr, param_3, _166), coverRGBA(uTo, uToSmplr, param_4, _166), float4(hitT));
        float4 _871 = particle;
        float3 _873 = _871.xyz * (1.0 + (0.1500000059604644775390625 * sin(3.141590118408203125 * hitT)));
        particle.x = _873.x;
        particle.y = _873.y;
        particle.z = _873.z;
        col = mix(col, particle, float4(hitCover));
    }
    fragColor = col;
}

static inline __attribute__((always_inline))
float4 flair_backgroundOpacity(thread const float4& c, thread const float3& bg, thread const float& opacity)
{
    if (opacity >= 1.0)
    {
        return c;
    }
    float3 d = fast::clamp(c.xyz, float3(0.0), float3(1.0)) - bg;
    float3 room = mix(bg, float3(1.0) - bg, step(float3(0.0), d));
    float3 k = abs(d) / fast::max(room, float3(9.9999997473787516355514526367188e-05));
    float a = fast::clamp(fast::max(k.x, fast::max(k.y, k.z)), 0.0, 1.0);
    float3 _929;
    if (a > 0.0)
    {
        _929 = bg + (d / float3(a));
    }
    else
    {
        _929 = bg;
    }
    float3 fg = _929;
    float alpha = a + (opacity * (1.0 - a));
    float3 _951;
    if (alpha > 0.0)
    {
        _951 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _951 = bg;
    }
    float3 col = _951;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _166, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _166, uFrom, uFromSmplr, uTo, uToSmplr);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _166.uBackground;
    float param_4 = _166.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_transition_particle_swap_frag_out flair_transition_particle_swap_frag(constant FlairUniforms& _166 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_transition_particle_swap_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1007;
    if (_166.flair_flipY > 0.5)
    {
        _1007 = _166.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1007 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1007);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _166, uFrom, uFromSmplr, uTo, uToSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

